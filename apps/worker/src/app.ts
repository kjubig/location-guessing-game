import {
  createGameRequestSchema,
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

interface AppDependencies {
  repositoryFactory?: (bindings: Bindings) => GameRepository;
}

function errorResponse(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

async function readJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 2_048) throw new Error("PAYLOAD_TOO_LARGE");
  return request.json();
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = new Hono<{ Bindings: Bindings }>();
  const repositoryFactory =
    dependencies.repositoryFactory ??
    ((bindings: Bindings) => new D1GameRepository(bindings.DB));

  app.use("/api/*", async (context, next) => {
    await next();
    context.header("Cache-Control", "no-store");
    context.header("X-Content-Type-Options", "nosniff");
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

    const game = await repositoryFactory(context.env).createGame(parsed.data);
    return context.json(game, 201);
  });

  app.get("/api/games/:gameId", async (context) => {
    const game = await repositoryFactory(context.env).getGame(
      context.req.param("gameId"),
    );
    return context.json(game);
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
    } else {
      console.error("Unhandled API error", error);
    }

    return context.json(errorResponse(code, message), status);
  });

  return app;
}

export const app = createApp();
