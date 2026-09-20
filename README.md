# GEOLUKITUKI

GEOLUKITUKI is a browser geography game about recognizing places from satellite
imagery and metro geometry. The first content pack covers South Korea, while the
architecture and repository name remain ready for other regions.

The project is also a learning repository. Important choices, commands, request
flows, and milestone retrospectives are documented as the application grows.

## Current state

M0–M4 application work is complete in the local environment and includes:

- React + Vite + TypeScript frontend;
- Cloudflare Worker API using Hono;
- Cloudflare Static Assets and D1 configuration;
- separate production and preview environments;
- pnpm workspace, tests, linting, formatting, and CI;
- dependency-free Python workspace for offline geospatial pipelines;
- 90 real Sentinel-2 WebP clues for 30 cities with reproducible provenance;
- nickname validation, distance and server-side scoring primitives;
- D1 game/round schema and server-controlled game API;
- a responsive five-round interface with game restore, result markers and line,
  summary, Polish/English translations, and light/dark themes;
- five real, anonymized OSM metro clues and satellite context for metro guesses;
- verified per-mode leaderboards, Turnstile, request limits, and bounded cleanup;
- component, API, domain, pipeline, data-leak, and production-build verification;
- bilingual source/licence page, keyboard/touch map controls, reduced motion,
  responsive layout, and explicit asset budgets.

M5 first-public-release work is in progress. Production and preview Workers,
D1 and Turnstile are online; automatic GitHub builds and final interactive
smoke tests remain. Human review of all clues and structured score tuning are
also unfinished. See [the implementation plan](docs/PLAN.md) and [architecture
decisions](docs/DECISIONS.md).

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
- [M3 implementation journal](docs/milestones/M3.md) — ranking transactions,
  abuse controls, and verification notes.
- [M4 implementation journal](docs/milestones/M4.md) — 30-city content pipeline,
  accessibility, release checks, failures, and operations.
- [M5 release journal](docs/milestones/M5.md) — D1, Turnstile, Workers Builds,
  environment isolation, deployment and smoke testing.
- [Sources and licences](docs/SOURCES.md) — attribution and reuse boundaries.
- [Release checklist](docs/RELEASE_CHECKLIST.md) — security, browser, content,
  migration, and rollback checks before production.

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

Current manual M5 deployments:

- production: <https://golukituki.golukituki-worker.workers.dev>;
- preview: <https://golukituki-preview.golukituki-worker.workers.dev>.

The production and preview D1 bindings in `apps/worker/wrangler.jsonc` contain
their Cloudflare database IDs. The remaining local zero UUID is intentional:
local development stores its emulated D1 data under `.wrangler/`.

## Licensing

Application code is MIT licensed. Third-party datasets and generated artifacts
retain their own terms. In particular, OSM-derived data is subject to ODbL and
Copernicus Sentinel imagery requires appropriate attribution. See
[`docs/SOURCES.md`](docs/SOURCES.md) before publishing data. The current
EOxCloudless guessing-map layer is suitable only for the project's
non-commercial test unless an appropriate commercial licence is obtained.
