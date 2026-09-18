import type { Coordinate, GameSnapshot } from "@golukituki/core";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import type { Bindings } from "../src/env";
import {
  GameNotFoundError,
  RoundAlreadyGuessedError,
  type CreateGameInput,
  type GameRepository,
} from "../src/game-repository";

const testEnvironment = { APP_ENV: "test" } as Bindings;

class MemoryGameRepository implements GameRepository {
  private game: GameSnapshot | undefined;

  createGame(input: CreateGameInput): Promise<GameSnapshot> {
    this.game = {
      completedRounds: [],
      currentRound: {
        attribution: "Contains modified Copernicus Sentinel data (2025)",
        clueUrl: "/clues/opaque.png",
        roundId: "round-1",
        roundNumber: 1,
        totalRounds: 5,
      },
      gameId: "game-1",
      mode: input.mode,
      nickname: input.nickname,
      status: "active",
      totalScore: 0,
    };
    return Promise.resolve(this.game);
  }

  getGame(gameId: string): Promise<GameSnapshot> {
    if (!this.game || this.game.gameId !== gameId) {
      return Promise.reject(new GameNotFoundError());
    }
    return Promise.resolve(this.game);
  }

  async submitGuess(gameId: string, guess: Coordinate): Promise<GameSnapshot> {
    const game = await this.getGame(gameId);
    if (!game.currentRound) throw new RoundAlreadyGuessedError();
    this.game = {
      ...game,
      completedRounds: [
        {
          answer: { latitude: 37.54, longitude: 126.95 },
          attribution: game.currentRound.attribution,
          clueUrl: game.currentRound.clueUrl,
          distanceKm: 12.3,
          guess,
          points: 3_910,
          roundNumber: 1,
        },
      ],
      currentRound: {
        ...game.currentRound,
        clueUrl: "/clues/next-opaque.png",
        roundId: "round-2",
        roundNumber: 2,
      },
      totalScore: 3_910,
    };
    return this.game;
  }
}

function testApp(repository = new MemoryGameRepository()) {
  return createApp({ repositoryFactory: () => repository });
}

describe("worker API", () => {
  it("reports health without exposing cacheable state", async () => {
    const response = await testApp().request(
      "http://localhost/api/health",
      {},
      testEnvironment,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({
      environment: "test",
      service: "golukituki-worker",
      status: "ok",
    });
  });

  it("creates a game without revealing the answer", async () => {
    const response = await testApp().request(
      "http://localhost/api/games",
      {
        body: JSON.stringify({
          nickname: "  \u1106\u1175\u11AB\u1109\u116E  ",
          mode: "satellite",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnvironment,
    );
    const body = await response.json<GameSnapshot>();

    expect(response.status).toBe(201);
    expect(body.nickname).toBe("민수");
    expect(body.currentRound?.clueUrl).toBe("/clues/opaque.png");
    expect(JSON.stringify(body.currentRound)).not.toContain("answer");
  });

  it("accepts the metro mode in the shared create-game contract", async () => {
    const response = await testApp().request(
      "http://localhost/api/games",
      {
        body: JSON.stringify({ nickname: "Metro Player", mode: "metro" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnvironment,
    );
    const body = await response.json<GameSnapshot>();

    expect(response.status).toBe(201);
    expect(body.mode).toBe("metro");
  });

  it("rejects an invalid nickname before touching storage", async () => {
    const response = await testApp().request(
      "http://localhost/api/games",
      {
        body: JSON.stringify({ nickname: "x", mode: "satellite" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnvironment,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("reveals the completed answer only after accepting a guess", async () => {
    const repository = new MemoryGameRepository();
    const app = testApp(repository);
    await repository.createGame({ nickname: "Player", mode: "satellite" });

    const response = await app.request(
      "http://localhost/api/games/game-1/guesses",
      {
        body: JSON.stringify({ latitude: 37.5, longitude: 127 }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      testEnvironment,
    );
    const body = await response.json<GameSnapshot>();

    expect(response.status).toBe(200);
    expect(body.completedRounds[0]).toMatchObject({
      answer: { latitude: 37.54, longitude: 126.95 },
      points: 3_910,
    });
    expect(body.currentRound?.roundNumber).toBe(2);
  });

  it("returns structured errors for a missing game and route", async () => {
    const app = testApp();
    const missingGame = await app.request(
      "http://localhost/api/games/missing",
      {},
      testEnvironment,
    );
    expect(missingGame.status).toBe(404);
    await expect(missingGame.json()).resolves.toEqual({
      error: { code: "GAME_NOT_FOUND", message: "Game not found" },
    });

    const missingRoute = await app.request(
      "http://localhost/api/missing",
      {},
      testEnvironment,
    );
    expect(missingRoute.status).toBe(404);
    await expect(missingRoute.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "API route not found" },
    });
  });
});
