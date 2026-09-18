# Project instructions

## Identity

- Display name: `GEOLUKITUKI`.
- Internal package/service namespace: `golukituki`.
- GitHub repository name: `location-guessing-game`.
- Code, comments, commit messages, and technical identifiers are in English.
- The user interface is Polish-first and ready for Polish/English localization.

## Commands

- `pnpm dev` — run Vite and the local Cloudflare Worker.
- `pnpm validate` — formatting, lint, types, tests, and production build.
- `pnpm pipeline:test` — run dependency-free Python pipeline tests.
- `pnpm db:migrate:local` — apply D1 migrations to local Wrangler state.

## Architecture rules

- Browser code never imports server-only answer manifests.
- Production and preview D1 databases are separate.
- Heavy raster/geospatial processing happens offline in `scripts/geodata`.
- Static browser assets live in `apps/web/public`.
- Shared domain rules belong in `packages/core`; UI and Worker adapters consume
  them rather than duplicating them.
- API responses containing game state use `Cache-Control: no-store`.
- Keep Worker request processing compatible with the Free plan's CPU budget.

## Quality and documentation

- Use strict TypeScript and validate external input at API boundaries.
- Add tests for domain rules and security-relevant state transitions.
- Run `pnpm validate` before every commit.
- Update the relevant file in `docs/milestones/` with tools, commands, behavior,
  verification, and any troubleshooting learned during a milestone.
- Prefer small Conventional Commits.
- Commits are authored only as `kjubig`; do not add assistant/co-author trailers.
- Do not create a commit until the repository-local Git name and email have been
  checked.
