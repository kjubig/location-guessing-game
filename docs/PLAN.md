# GEOLUKITUKI MVP — implementation plan

Status: active; [`DECISIONS.md`](./DECISIONS.md) accepted with amendments  
Last updated: 2026-09-18

## Goal

Deliver a publicly accessible South Korea geography game with two five-round
modes, server-controlled answers and scoring, and a verified top-ten leaderboard.
The production branch must deploy automatically from GitHub and the complete MVP
must operate within free service tiers.

## Planning principles

- Build one playable vertical slice before expanding the content pool.
- Introduce the server-owned round contract in the first playable milestone so
  no insecure prototype format becomes part of the application.
- Keep runtime work small. All raster and heavy geospatial processing happens
  offline and produces deterministic, validated artifacts.
- Treat data provenance, attribution, and answer-leak validation as product
  requirements, not release cleanup.
- Finish every milestone with passing checks, a deployable build, and a short
  review before starting the next milestone.

## Milestone overview

| Milestone | Outcome                                           | Review gate                                 |
| --------- | ------------------------------------------------- | ------------------------------------------- |
| M0        | Repository foundation and first public deployment | Public health/hello page from `main`        |
| M1        | Complete satellite-mode vertical slice            | Five secure rounds on a small fixture pool  |
| M2        | Metro pipeline and complete metro mode            | Real OSM geometry with no coordinate leak   |
| M3        | Durable ranking and abuse controls                | Only verified completed games enter top ten |
| M4        | Full content, polish, licenses, and release QA    | Definition of done satisfied                |

## M0 — foundation and first deployment

### Scope

1. Initialize the repository and workspace:
   - target private GitHub repository name: `location-guessing-game`;
   - internal package/service namespace: `golukituki`;
   - pnpm workspace;
   - `apps/web`, `apps/worker`, and `packages/core`;
   - Python `uv` project under `scripts/geodata`;
   - pinned Node.js and Python versions.
2. Scaffold the runtime:
   - React, Vite, TypeScript, and Tailwind CSS;
   - Cloudflare Worker serving `/api/health` and the built SPA;
   - Wrangler configuration with local, production, and preview D1 bindings;
   - Polish-first i18n structure with an English catalog.
3. Add project quality controls:
   - ESLint, Prettier, TypeScript strict mode, and Vitest;
   - root commands for lint, format check, typecheck, test, build, and local dev;
   - GitHub Actions running all checks on pushes and pull requests;
   - dependency caching and reproducible lockfiles.
4. Add repository documentation:
   - `README.md`, `CLAUDE.md`, MIT license, `.env.example`, `.gitignore`;
   - contribution conventions and Conventional Commits;
   - deployment and local D1 instructions.
5. Connect deployment after the owner completes the Cloudflare/GitHub setup.

### Tests and verification

- root quality commands run successfully from a clean checkout;
- the production bundle contains no source map or environment secret by default;
- `/api/health` responds locally and from the deployed Worker;
- an SPA route survives a direct browser refresh;
- a non-production branch receives a preview URL.

### Exit criteria

- CI is green;
- pushing to `main` updates a public `workers.dev` URL;
- the same build can be run locally without production credentials;
- repository setup and deployment are documented.

### Owner actions

- create the private `location-guessing-game` GitHub repository;
- create a free Cloudflare account;
- authorize the Cloudflare GitHub integration;
- create separate production and preview D1 databases using the supplied
  instructions;
- enable production and non-production branch builds.

## M1 — satellite-mode vertical slice

### Scope

1. Define the shared domain model and API schemas:
   - game modes, game state, round state, guesses, results, and errors;
   - Unicode NFC nickname normalization and 2–20 character validation;
   - haversine and exponential scoring configuration.
2. Implement the minimal D1 model:
   - round assets, games, and game rounds;
   - migrations and deterministic local seed data;
   - indexed active-game and round lookups.
3. Implement server-controlled gameplay:
   - create a five-round game;
   - return only an opaque clue ID and asset URL before a guess;
   - atomically accept the first guess;
   - reveal location, distance, and server-computed points afterward;
   - reject replayed, skipped, expired, or malformed requests.
4. Build the Polish user flow:
   - start screen and nickname entry;
   - mode selection;
   - clue view with round/score status;
   - responsive MapLibre guess map using a coarse Natural Earth basemap;
   - result view with guess-to-answer line;
   - five-round summary and play again.
5. Add a small development pool of curated, metadata-free fixture images. Each
   answer is the center of the displayed crop rather than a city-center point.
6. Establish the data publishing contract and automated answer-leak checks.

### Tests and verification

- unit tests for haversine, scoring boundaries, nickname validation, and schemas;
- Worker integration tests for round order, first-guess locking, expiry, and
  client-supplied score rejection;
- metadata and filename leak checks for all published clues;
- responsive manual checks on desktop and mobile viewport sizes;
- browser network inspection confirms no answer before submitting a guess.

### Exit criteria

- a user can finish five satellite rounds and see a verified total;
- refreshing during an active game restores or safely resumes its state;
- coordinates and clue mappings do not appear in the web bundle, public
  manifests, filenames, metadata, or pre-guess API responses;
- light and dark themes are functional, even if not yet fully polished.

## M2 — metro pipeline and mode

### Scope

1. Build a cached, reproducible OSM acquisition step for South Korean subway and
   light-rail routes and stations.
2. Store raw response checksums, retrieval time, query text, and attribution.
3. Normalize route topology and station associations.
4. Select eligible stations and generate round clues:
   - crop a configurable network radius;
   - transform WGS84 geometry to a local drawing coordinate system;
   - remove all identifying tags and source coordinates;
   - assign opaque asset identifiers;
   - validate geometry and minimum clue complexity.
5. Generate a filtered OSM-derived map as small vector tiles through zoom 12,
   with a target around 5,000 files and hard checks for Cloudflare's asset limits.
6. Implement the Mini Metro-inspired renderer with neutral lines and station
   dots, including responsive scaling and theme variants.
7. Reuse the M1 server contract, scoring, result, and summary components.
8. Add configurable metro scoring scale and excerpt radius.

### Tests and verification

- pipeline unit tests use committed small OSM fixtures and never call Overpass
  in CI;
- topology and projection tests cover disconnected routes and duplicate stations;
- published asset validation rejects longitude/latitude ranges, identifying
  properties, or non-opaque filenames;
- a manual sample covers every included metro area;
- a full five-round metro game passes the same API security checks as M1.

### Exit criteria

- metro mode is playable from start to summary;
- clues preserve real shape but expose no georeference;
- source refresh is a documented one-command pipeline after credentials/network
  access are available;
- visible OSM/ODbL attribution is present.

## M3 — leaderboard and abuse controls

### Scope

1. Finalize leaderboard storage and indexed top-ten queries per mode.
2. Insert a leaderboard entry automatically after the fifth accepted guess.
3. Add game expiry and bounded cleanup of stale rows.
4. Add Cloudflare Turnstile to game creation:
   - production widget verification;
   - documented official test keys for local development and CI;
   - fail-closed behavior in production.
5. Add a conservative Worker Rate Limiting binding for game creation, using a
   separate namespace in preview and treating IP limits as a coarse abuse guard.
6. Add input/request size limits and consistent API error responses.
7. Add basic observability without logging nicknames, coordinates, tokens, or
   other unnecessary user data.
8. Document quota-exhaustion behavior and operational checks for Workers and D1.

### Tests and verification

- forged totals and incomplete games cannot create leaderboard entries;
- duplicate/concurrent final guesses create at most one entry;
- nickname output is safely rendered as text;
- Turnstile failure, expiry, and missing token paths are tested;
- top-ten queries use indexes and return stable ordering for tied scores;
- daily quota failure is handled with a user-readable temporary error.

### Exit criteria

- separate satellite and metro rankings work in production;
- every displayed score can only originate from a completed server-side game;
- spam protection and failure behavior are documented;
- no secret is present in Git history or built assets.

### Owner actions

- create a Turnstile widget for the production/preview hostnames;
- save the secret through Cloudflare's secret configuration;
- provide only the public site key to the frontend environment.

## M4 — full content and release polish

### Scope

1. Finalize the 30–50 city list with stable ID, English transliteration, Hangul,
   coordinates, and opaque clue asset IDs.
2. Build the Sentinel-2 generation pipeline:
   - query/select low-cloud L2A products;
   - create 3–5 consistent true-color crops per city with controlled offsets;
   - normalize and resize output;
   - strip metadata and emit opaque WebP filenames;
   - use the displayed crop center as its answer;
   - record private provenance and reproducibility data.
3. Curate every satellite clue for recognizability, cloud cover, artifacts, and
   accidental labels or metadata.
4. Tune scoring scales and metro excerpt size using structured test sessions.
5. Complete UI and accessibility:
   - keyboard navigation, focus states, semantic labels, contrast;
   - touch ergonomics and map expansion behavior;
   - reduced-motion support;
   - final light/dark designs and error/empty/loading states.
6. Complete attribution and licensing:
   - visible per-view credits where required;
   - dedicated sources and licenses page;
   - clear separation between MIT application code and third-party data.
7. Complete documentation and release QA:
   - local setup, deployment, migrations, pipeline refresh, backup/export;
   - browser smoke tests and performance/asset budgets;
   - production security and answer-leak checklist.

### Tests and verification

- pipeline output is deterministic for pinned inputs/configuration;
- all 30–50 city assets pass metadata and leak validation;
- both modes complete on supported desktop and mobile browsers;
- accessibility smoke checks pass for all main screens;
- production assets and API responses are inspected once more before release;
- public documentation accurately reflects current free-tier limitations.

### Exit criteria

- both modes provide a complete five-round experience;
- correct answers are unavailable to the browser before a guess;
- rankings save and display verified results;
- production deploys automatically from `main` and previews work;
- all sources are attributed and their reuse terms documented;
- the application stays within the documented free tiers at expected MVP usage.

### Owner actions

- create a free CDSE account;
- store CDSE client credentials only in the ignored local environment file;
- review the final city/clue selection and attribution page.

## Cross-cutting workstreams

### Data and licensing

Every generated dataset receives a provenance record containing source, license,
retrieval date, transformation version, and checksum. OSM-derived data remains
under ODbL obligations; application code can remain MIT. Sentinel attribution is
shown both near the imagery and on the full sources page.

### Security and privacy

The API stores only what the game needs. No account, email address, advertising
identifier, or precise player location is requested. Guess coordinates are game
data and should have a documented retention period. Logs must exclude game
tokens, Turnstile tokens, answer coordinates, and request bodies.

### Accessibility and responsive design

Accessibility is verified in every milestone rather than deferred entirely to
M4. Core gameplay must remain possible with keyboard controls, visible focus,
adequate contrast, and touch targets suitable for mobile screens.

### Testing strategy

- unit tests: shared domain rules and deterministic pipeline transforms;
- integration tests: Worker API and local D1 migrations;
- contract tests: browser/Worker schema compatibility;
- leak tests: public assets, metadata, filenames, and bundles;
- smoke tests: one complete game per mode against preview/production;
- manual visual review: maps, clue rendering, themes, and responsive layouts.

## Proposed pull request sequence

The exact split may change during implementation, but each change should remain
reviewable and independently green.

1. `chore: initialize workspace and quality tooling`
2. `feat: serve web app and health API from Cloudflare Worker`
3. `ci: add validation and production build workflow`
4. `feat: add game domain and scoring primitives`
5. `feat: implement secure satellite round API`
6. `feat: build satellite gameplay flow`
7. `feat: add metro data pipeline`
8. `feat: implement metro gameplay`
9. `feat: add verified leaderboards and Turnstile`
10. `feat: add production clue catalog and release polish`

## Main risks and mitigations

| Risk                                            | Impact                         | Mitigation                                                                             |
| ----------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| Metro coordinates leak through clue data        | Breaks anti-cheat              | Publish only local drawing coordinates and run automated leak checks                   |
| Satellite filenames/metadata reveal cities      | Breaks anti-cheat              | Opaque filenames, metadata stripping, private manifest, CI validation                  |
| Public tiles reveal metro infrastructure        | Makes clues trivial            | Self-host a filtered map without rail/transit layers                                   |
| Overpass is overloaded or rejects a large query | Blocks data refresh            | Cache raw responses; split sequential queries; allow regional extract fallback         |
| Worker 10 ms CPU limit                          | API errors under load          | Precompute all heavy work; keep scoring and indexed SQL minimal                        |
| D1 daily quota is exhausted                     | Games/ranking temporarily fail | Indexed bounded queries, monitoring, graceful errors, documented limits                |
| Sentinel imagery is cloudy or inconsistent      | Poor gameplay                  | Low-cloud selection plus mandatory manual curation                                     |
| Mobile map interactions conflict with scrolling | Poor usability                 | Explicit expanded-map state, large controls, early device testing                      |
| Product/repository name changes                 | Broken references              | Keep display name, package namespace, and remote repository name separately configured |

## Implementation state

`DECISIONS.md` has been accepted with amendments. The repository foundation and
the complete M1 satellite vertical slice are implemented and verified locally.
M2 is active: its real OSM clue pipeline and playable metro vertical slice are
complete, while the filtered zoom-12 vector basemap remains in progress.
The GitHub repository exists; the first public Cloudflare deployment remains an
M0 owner action because it requires the owner's Cloudflare account and real D1
resource IDs. M2 has not started.
