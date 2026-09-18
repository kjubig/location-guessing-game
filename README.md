# GEOLUKITUKI

GEOLUKITUKI is a browser geography game about recognizing places from satellite
imagery and metro geometry. The first content pack covers South Korea, while the
architecture and repository name remain ready for other regions.

The project is also a learning repository. Important choices, commands, request
flows, and milestone retrospectives are documented as the application grows.

## Current state

M0 established the foundation. The M1 satellite vertical slice is complete in
the local environment and includes:

- React + Vite + TypeScript frontend;
- Cloudflare Worker API using Hono;
- Cloudflare Static Assets and D1 configuration;
- separate production and preview environments;
- pnpm workspace, tests, linting, formatting, and CI;
- Python/uv workspace reserved for geospatial pipelines;
- five real Sentinel-2 development clues with reproducible provenance;
- nickname validation, distance and server-side scoring primitives;
- D1 game/round schema and server-controlled game API;
- a responsive five-round interface with game restore, result markers and line,
  summary, Polish/English translations, and light/dark themes;
- component, API, domain, data-leak, and production-build verification.

M2 is now active. Its first playable checkpoint adds five real, anonymized OSM
metro clues, a server-scored metro mode, and a dedicated SVG renderer. The
filtered detailed guessing-map tiles remain to be implemented. The first public
Cloudflare deployment remains a separate owner setup step. See [the
implementation plan](docs/PLAN.md) and [architecture decisions](docs/DECISIONS.md).

## Learn how it works

- [System architecture](docs/ARCHITECTURE.md) — browser, Worker, D1, assets, and
  deployment flow.
- [Local development](docs/LOCAL_DEVELOPMENT.md) — installation and commands.
- [Deployment](docs/DEPLOYMENT.md) — GitHub, D1, Workers Builds, previews,
  migrations, and rollback.
- [M0 technical journal](docs/milestones/M0.md) — what was installed, why, and
  how the foundation was verified.
- [M1 technical journal](docs/milestones/M1.md) — satellite data, game rules,
  D1 storage, API contracts, tests, and the current continuation point.
- [M2 technical journal](docs/milestones/M2.md) — OSM acquisition, anonymized
  metro geometry, D1 migration, renderer, and verification notes.
- [Data formats](docs/DATA_FORMATS.md) — city catalog and future clue manifests.

## Quick start

Requirements:

- Node.js 24;
- pnpm 10.17.1 through Corepack;
- Python 3.13 for the data workspace.

```bash
corepack enable
corepack prepare pnpm@10.17.1 --activate
pnpm install
pnpm dev
```

The web application starts on `http://localhost:5173`. Vite forwards `/api/*`
requests to the local Worker on `http://localhost:8787`.

Run all repository checks with:

```bash
pnpm validate
pnpm pipeline:test
```

## Deployment model

Cloudflare Workers Builds connects directly to the private GitHub repository:

- pushes to `main` build and deploy `golukituki`;
- other branches upload `golukituki-preview` versions;
- production and preview use separate D1 databases;
- GitHub Actions validates code but does not own production credentials.

The zero UUID values in `apps/worker/wrangler.jsonc` are intentional placeholders.
Replace them with the IDs returned after creating both D1 databases.

## Licensing

Application code is MIT licensed. Third-party datasets and generated artifacts
retain their own terms. In particular, OSM-derived data is subject to ODbL and
Copernicus Sentinel imagery requires appropriate attribution. See
`docs/DECISIONS.md` before publishing data.
