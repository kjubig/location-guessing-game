import { describe, expect, it } from "vitest";

import { app } from "../src/app";
import type { Bindings } from "../src/env";

const testEnvironment = {
  APP_ENV: "test",
} as Bindings;

describe("worker API", () => {
  it("reports health without exposing cacheable state", async () => {
    const response = await app.request(
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

  it("returns a JSON 404 for unknown API routes", async () => {
    const response = await app.request(
      "http://localhost/api/missing",
      {},
      testEnvironment,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "API route not found",
    });
  });
});
