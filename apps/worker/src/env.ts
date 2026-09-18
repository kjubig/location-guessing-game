export interface Bindings {
  APP_ENV: string;
  ASSETS: Fetcher;
  DB: D1Database;
  GAME_CREATION_LIMITER: RateLimit;
  TURNSTILE_SECRET_KEY: string;
}
