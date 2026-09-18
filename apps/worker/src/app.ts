import { INTERNAL_SLUG, type HealthResponse } from "@golukituki/core";
import { Hono } from "hono";

import type { Bindings } from "./env";

export const app = new Hono<{ Bindings: Bindings }>();

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

app.notFound((context) => {
  if (context.req.path.startsWith("/api/")) {
    return context.json({ error: "API route not found" }, 404);
  }

  return context.env.ASSETS.fetch(context.req.raw);
});
