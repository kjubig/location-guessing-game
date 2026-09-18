import {
  createGameRequestSchema,
  gameModeSchema,
  INTERNAL_SLUG,
  submitGuessRequestSchema,
  type ApiErrorResponse,
  type HealthResponse,
} from "@golukituki/core";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { Bindings } from "./env";
import {
  D1GameRepository,
  GameExpiredError,
  GameNotFoundError,
  InsufficientAssetsError,
  RoundAlreadyGuessedError,
  type GameRepository,
} from "./game-repository";
import {
  CloudflareTurnstileVerifier,
  type TurnstileVerifier,
} from "./turnstile";

interface AppDependencies {
  rateLimiterFactory?: (bindings: Bindings) => RateLimit;
  repositoryFactory?: (bindings: Bindings) => GameRepository;
  turnstileVerifier?: TurnstileVerifier;
}

function errorResponse(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

async function readJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 2_048) throw new Error("PAYLOAD_TOO_LARGE");
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 2_048) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }
  return JSON.parse(body) as unknown;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = new Hono<{ Bindings: Bindings }>();
  const repositoryFactory =
    dependencies.repositoryFactory ??
    ((bindings: Bindings) => new D1GameRepository(bindings.DB));
  const rateLimiterFactory =
    dependencies.rateLimiterFactory ??
    ((bindings: Bindings) => bindings.GAME_CREATION_LIMITER);
  const turnstileVerifier =
    dependencies.turnstileVerifier ?? new CloudflareTurnstileVerifier();

  app.use("/api/*", async (context, next) => {
    const startedAt = Date.now();
    await next();
    context.header("Cache-Control", "no-store");
    context.header("X-Content-Type-Options", "nosniff");
    console.info(
      JSON.stringify({
        durationMs: Date.now() - startedAt,
        environment: context.env.APP_ENV,
        event: "api_request",
        method: context.req.method,
        status: context.res.status,
      }),
    );
  });

  app.get("/api/health", (context) => {
    const body: HealthResponse = {
      environment: context.env.APP_ENV,
      service: `${INTERNAL_SLUG}-worker`,
      status: "ok",
      timestamp: new Date().toISOString(),
    };
    return context.json(body);
  });

  app.post("/api/games", async (context) => {
    const remoteIp = context.req.header("CF-Connecting-IP");
    const rateLimit = await rateLimiterFactory(context.env).limit({
      key: remoteIp ?? "local-development",
    });
    if (!rateLimit.success) {
      return context.json(
        errorResponse(
          "RATE_LIMITED",
          "Too many games were started. Try again in a minute.",
        ),
        429,
      );
    }

    const parsed = createGameRequestSchema.safeParse(
      await readJson(context.req.raw),
    );
    if (!parsed.success) {
      return context.json(
        errorResponse(
          "INVALID_REQUEST",
          parsed.error.issues[0]?.message ?? "Invalid request",
        ),
        400,
      );
    }

    let verified: boolean;
    try {
      verified = await turnstileVerifier.verify({
        remoteIp,
        secret: context.env.TURNSTILE_SECRET_KEY,
        token: parsed.data.turnstileToken,
      });
    } catch {
      return context.json(
        errorResponse(
          "VERIFICATION_UNAVAILABLE",
          "Human verification is temporarily unavailable. Try again later.",
        ),
        503,
      );
    }
    if (!verified) {
      return context.json(
        errorResponse(
          "TURNSTILE_FAILED",
          "Human verification failed. Please try again.",
        ),
        403,
      );
    }

    const game = await repositoryFactory(context.env).createGame({
      mode: parsed.data.mode,
      nickname: parsed.data.nickname,
    });
    return context.json(game, 201);
  });

  app.get("/api/games/:gameId", async (context) => {
    const game = await repositoryFactory(context.env).getGame(
      context.req.param("gameId"),
    );
    return context.json(game);
  });

  app.get("/api/leaderboard", async (context) => {
    const parsedMode = gameModeSchema.safeParse(context.req.query("mode"));
    if (!parsedMode.success) {
      return context.json(
        errorResponse("INVALID_MODE", "Mode must be satellite or metro"),
        400,
      );
    }

    const entries = await repositoryFactory(context.env).getLeaderboard(
      parsedMode.data,
    );
    return context.json({ entries, mode: parsedMode.data });
  });

  app.post("/api/games/:gameId/guesses", async (context) => {
    const parsed = submitGuessRequestSchema.safeParse(
      await readJson(context.req.raw),
    );
    if (!parsed.success) {
      return context.json(
        errorResponse(
          "INVALID_GUESS",
          parsed.error.issues[0]?.message ?? "Invalid guess",
        ),
        400,
      );
    }

    const game = await repositoryFactory(context.env).submitGuess(
      context.req.param("gameId"),
      parsed.data,
    );
    return context.json(game);
  });

  app.notFound((context) => {
    if (context.req.path.startsWith("/api/")) {
      return context.json(
        errorResponse("NOT_FOUND", "API route not found"),
        404,
      );
    }
    return context.env.ASSETS.fetch(context.req.raw);
  });

  app.onError((error, context) => {
    let status: ContentfulStatusCode = 500;
    let code = "INTERNAL_ERROR";
    let message = "Unexpected server error";

    if (error.message === "PAYLOAD_TOO_LARGE") {
      status = 413;
      code = "PAYLOAD_TOO_LARGE";
      message = "Request body is too large";
    } else if (error instanceof SyntaxError) {
      status = 400;
      code = "INVALID_JSON";
      message = "Request body must be valid JSON";
    } else if (error instanceof GameNotFoundError) {
      status = 404;
      code = "GAME_NOT_FOUND";
      message = "Game not found";
    } else if (error instanceof GameExpiredError) {
      status = 410;
      code = "GAME_EXPIRED";
      message = "Game has expired";
    } else if (error instanceof RoundAlreadyGuessedError) {
      status = 409;
      code = "ROUND_LOCKED";
      message = "This round has already been answered";
    } else if (error instanceof InsufficientAssetsError) {
      status = 503;
      code = "CONTENT_UNAVAILABLE";
      message = "Not enough enabled clues are available";
    } else if (/D1|database|quota/i.test(error.message)) {
      status = 503;
      code = "SERVICE_UNAVAILABLE";
      message = "The game service is temporarily unavailable";
      console.error("Storage operation failed", { name: error.name });
    } else {
      console.error("Unhandled API error", { name: error.name });
    }

    return context.json(errorResponse(code, message), status);
  });

  return app;
}

export const app = createApp();
