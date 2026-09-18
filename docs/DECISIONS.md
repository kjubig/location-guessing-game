# GEOLUKITUKI MVP — architecture decisions and delivery plan

Status: accepted with review amendments  
Last reviewed: 2026-09-18

## Summary

The product plan is sound and realistically scoped as an MVP, with one important
technical correction: metro clue geometry sent to the browser must not contain
real-world coordinates. Each clue will therefore be rendered from a translated
local coordinate system, while its answer remains server-side.

The user-facing product name is **GEOLUKITUKI**. Naming is deliberately split:

- GitHub repository: `location-guessing-game` (descriptive and not tied to Korea);
- internal package/service namespace: `golukituki`;
- interface and product copy: `GEOLUKITUKI`.

The GitHub repository can be renamed later without coupling the source code to
its remote repository name.

## Decisions

### 1. Hosting and architecture

**Decision:** Cloudflare Workers with Static Assets, Workers Builds, D1, and
Turnstile. Do not start a new project on Cloudflare Pages.

One Worker will serve the built React application and `/api/*`. Static clue
assets will bypass Worker execution, while game state and answers will only be
available to the Worker through D1. This avoids a separate frontend/backend
deployment and removes cross-origin configuration.

Production and preview deployments must use separate D1 databases. The
`preview` Wrangler environment has its own Worker name, bindings, migrations,
rate-limit namespace, and Turnstile hostname configuration. A pull-request game
must never write to the production ranking.

Why:

- Cloudflare now recommends Workers rather than Pages for new applications.
- GitHub integration deploys the production branch automatically and can build
  non-production branches into public preview URLs.
- The Free plan does not require a credit card and currently includes 100,000
  dynamic Worker requests per day; static asset requests are free and unlimited.
- Workers Builds currently includes 3,000 build minutes per month, one concurrent
  build, and a 20-minute build timeout.
- D1 Free currently includes 5 million rows read per day, 100,000 rows written
  per day, and 5 GB total storage. These limits are ample for an MVP but are hard
  limits: database calls fail until reset after a daily quota is exceeded.
- A static asset is limited to 25 MiB and a Worker version to 20,000 static files.
  The planned 30–50 optimized WebP clues fit comfortably.

Operational limit: the Worker Free plan has a 10 ms CPU budget per invocation.
The API must therefore keep scoring and queries small and indexed. Image and
geospatial processing belongs in the offline pipeline, never in the Worker.

Sources:

- [Cloudflare recommends Workers for new projects](https://developers.cloudflare.com/pages/)
- [Workers pricing and D1 quotas](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers platform and asset limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers Builds limits](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/)
- [GitHub integration and preview deployments](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
- [Cloudflare Free does not require a credit card](https://www.cloudflare.com/products/workers/)

### 2. Frontend

**Decision:** React, Vite, TypeScript, and Tailwind CSS.

React is a good fit for the stateful five-round flow and has mature MapLibre and
i18n integrations. Vite keeps the SPA small and deployment platform-neutral.
SvelteKit would also work, but its server features duplicate the Worker API
architecture. Next.js adds unnecessary runtime and deployment complexity for
this client-heavy product.

Planned supporting libraries:

- React Router for resumable routes and refresh-safe navigation;
- `i18next`/`react-i18next`, Polish first with English message files present;
- Zod schemas shared between the browser and Worker;
- no global state library initially; game state stays in a small typed context.

### 3. Guessing map

**Decision:** MapLibre GL JS with a deliberately minimal country outline for
satellite rounds and satellite terrain context for metro rounds.

M1 renders a coarse, self-hosted Natural Earth outline. In satellite mode that
outline remains intentionally empty: adding city labels or aerial imagery would
give hints while the player is identifying a satellite crop.

In metro mode M2 uses the public EOxCloudless 2025 WMTS as a raster layer. It
shows terrain and urban extent without place labels or rail/transit features.
This is materially more useful for a small friends-and-family test than building
and hosting roughly 5,000 OSM vector tiles, and it needs no API key. The source
is loaded only in metro games and carries its required attribution in the
MapLibre source definition.

The current EOxCloudless layer is licensed for non-commercial use under CC
BY-NC-SA 4.0. Before any commercial release it must be replaced by self-hosted
imagery, an appropriately licensed provider, or a commercial EOX license. The
external service is also an availability dependency; if it fails, the map falls
back to a dark background and the game API continues to work.

MapLibre remains preferable to Leaflet because it gives consistent WebGL raster
rendering and result-line styling with the same component.

Sources:

- [MapLibre GL JS documentation](https://maplibre.org/maplibre-gl-js/docs/)
- [EOxCloudless license and attribution](https://cloudless.eox.at/documentation/license)
- [EOX public WMTS/WMS integration guide](https://cloudless.eox.at/documentation/usage)

### 4. Database and API

**Decision:** Cloudflare D1 with SQL migrations committed to the repository and
a small typed Hono Worker API. Production and preview use different D1 database
IDs and local development uses Wrangler's local database.

Core tables:

- `round_assets`: private mapping from opaque asset ID to mode, answer coordinate,
  source/provenance, and enabled state;
- `games`: opaque game ID, nickname, mode, current round, timestamps, and state;
- `game_rounds`: selected asset, answer state, guess, distance, and awarded points;
- `leaderboard_entries`: normalized nickname key, display nickname, mode,
  verified total, and completion time.

Indexes will cover asset selection, active game lookup, expiry, and leaderboard
queries. The top-ten query will never scan the full table.

The API contract will be:

1. `POST /api/games` validates nickname and Turnstile, selects five rounds, and
   returns only the game ID and the first opaque clue asset URL.
2. `POST /api/games/:id/guesses` accepts a coordinate. A conditional
   `UPDATE ... WHERE guessed_at IS NULL RETURNING ...` makes the first guess
   authoritative and prevents concurrent replay. Only then does the server
   return the correct coordinate, distance, and score.
3. After round five, the Worker computes the verified total and creates the
   leaderboard entry itself. The client never submits a score.
4. `GET /api/leaderboard?mode=...` returns a bounded top ten with at most one
   entry per normalized nickname and mode. A later lower score does not replace
   that nickname's best score.

Game and answer responses will use `Cache-Control: no-store`. Expired game rows
will be removed by a daily scheduled cleanup or bounded opportunistic cleanup.

### 5. Satellite imagery

**Decision:** Sentinel-2 L2A imagery selected and rendered offline by a Python
script and committed as optimized WebP. M4 verified Microsoft Planetary
Computer's anonymous STAC and Data APIs and uses them for the MVP. CDSE remains
an alternative if the service or licensing requirements change.

The pipeline selects low-cloud imagery, requests consistent 512 px true-color
tiles, rejects EXIF/XMP metadata, and writes deterministic opaque asset
identifiers. Each of 30 cities has three controlled nearby crops so the game is
not learned after seeing one image. The correct answer
is the geographic center of the displayed crop, not an administrative or
subjective city center.

A private-repository manifest will retain source product ID, acquisition date,
crop bounds, answer coordinate, and asset ID for reproducibility; none of that
manifest is copied into public frontend assets.

Planetary Computer avoids a project account for this fixed pipeline and its Data
API returns WebP directly, so no local raster dependency was added. The source
manifest pins every item and tile because anonymous service availability is not
a runtime guarantee. Copernicus Sentinel data permits reproduction,
distribution, public communication, adaptation, and combination, subject to the
legal notice and appropriate attribution.

Each clue will show a visible credit such as `Contains modified Copernicus
Sentinel data (year)`, with full provenance in the application's attribution
page. The exact final credit line will be checked against the selected API's
output terms before the full data run.

Sources:

- [CDSE quotas and limitations](https://documentation.dataspace.copernicus.eu/Quotas.html)
- [CDSE terms and registration](https://dataspace.copernicus.eu/terms-and-conditions)
- [Copernicus Sentinel data legal notice](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice)

### 6. Metro mode

**Decision:** mechanism A — identify a network excerpt and click its real
location on the map.

The baseline difficulty will use:

- a north-up excerpt around a sampled station;
- true line geometry transformed to local, non-georeferenced coordinates;
- thick neutral-gray lines and visible station dots;
- no station names, line names, basemap, or river;
- a configurable excerpt radius and an 8 km initial scoring scale.

Color, river context, and excerpt size become explicit difficulty modifiers after
the baseline is playable. Mechanism B is rejected for the MVP because only a few
South Korean metro areas make city selection repetitive and too easy.

OSM will be fetched once by the pipeline and not at runtime. The script will use
identifying headers, run sequentially, cache its raw response, and stay within
the public Overpass fair-use guidance. If the query proves too large or
unreliable, a Korean regional OSM extract will replace Overpass without changing
the normalized output format.

Source:

- [Overpass API public instance guidance](https://wiki.openstreetmap.org/wiki/Overpass_API)

### 7. Data pipeline language

**Decision:** Python, managed with `uv`, while application code remains
TypeScript in a pnpm workspace.

Python has the stronger geospatial/raster toolchain for reprojection, geometry
clipping, raster processing, and metadata stripping. The boundary is clean:
Python produces validated static artifacts and manifests; TypeScript consumes
their documented schemas. Pipeline tests will use small fixtures and will not
call external services in CI.

### 8. Repository visibility and answer data

**Decision:** use a private GitHub repository during the friends-and-family MVP.

This is the simplest way to retain reproducible answer manifests without making
them a public lookup table. GitHub Actions and Cloudflare Git integration support
private repositories on their free tiers. If the code is later made public, the
answer manifest and D1 seed step must first move to a private artifact store or a
separate private data repository.

The current test phase does not aim to resist a determined player with repository
or database access. It does prevent accidental answer exposure in normal browser
resources and keeps the API design compatible with stronger controls later.

## Security and anti-cheat threat model

The MVP protects answers from ordinary browser inspection before a guess. It
does not attempt to stop a determined player with repository/database access or
someone performing visual reverse-searching.

Controls:

- answer coordinates and clue-to-answer mappings never enter the web build;
- image and clue filenames are opaque and contain no city/line name;
- image EXIF/XMP/geotags are stripped and verified in CI/data validation;
- metro clues contain local drawing coordinates, not longitude/latitude;
- a round response contains only an opaque round ID and clue asset URL;
- the first server-accepted guess locks the round before revealing the answer;
- score and leaderboard insertion are server-computed only;
- nicknames are normalized to Unicode NFC and validated (2–20 characters,
  including common two-syllable Hangul names; Unicode letters,
  numbers, spaces, `_` and `-`; control characters and repeated whitespace are
  rejected);
- Cloudflare Turnstile protects game creation; its Free plan currently permits
  up to 20 widgets and unlimited verification requests;
- the Worker Rate Limiting binding adds a permissive burst limit to game creation.
  It is location-scoped and eventually consistent, so it is an abuse guard rather
  than an accounting/security boundary. IP-based keys will be conservative
  because multiple legitimate users may share one address;
- completed/expired game IDs cannot be reused, and request bodies are bounded.

Source:

- [Cloudflare Turnstile Free plan](https://developers.cloudflare.com/turnstile/plans/)
- [Workers Rate Limiting binding and limitations](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

## Scoring

The Worker is the source of truth. Shared pure functions will implement haversine
distance and:

`points = round(5000 * exp(-distanceKm / scaleKm))`

Initial configuration:

- satellite mode: `scaleKm = 50`;
- metro mode: `scaleKm = 8`;
- each round is clamped to 0–5000; a game is clamped to 0–25,000.

The values stay in configuration and will be tuned from test sessions rather
than embedded in components.

## Repository layout

```text
apps/
  web/                  React/Vite application
  worker/               Cloudflare Worker API and static-asset entrypoint
packages/
  core/                 shared domain types, schemas, scoring, validation
data/
  source/               reviewed source lists and raw-data checksums
  cities.json            city catalog: id, English name, Hangul, coordinates
apps/web/public/
  clues/                 opaque, metadata-free runtime assets
  map/                   Natural Earth country outline
scripts/
  geodata/              dependency-free Python pipelines
migrations/             D1 SQL migrations
docs/                   decisions, data provenance, operations
```

`apps/web/public/` must pass an automated leak check before build. The city
catalog schema contains `id`, English transliteration, Hangul name, longitude,
latitude, and an array of opaque clue asset IDs. Answer coordinates and crop
bounds remain in the private source manifest/server seed. Source/provenance
data has its own license notices; the MIT license applies to application code,
not automatically to third-party or derived datasets.

## Delivery plan

### M0 — foundation and first deployment

- initialize pnpm workspace and Python `uv` project;
- scaffold React/Vite, Worker static assets/API health endpoint, Tailwind, and
  Polish/English i18n structure;
- add ESLint, Prettier, Vitest, typecheck, `.env.example`, `.gitignore`, MIT
  license, `README.md`, and `CLAUDE.md`;
- add GitHub Actions for lint, typecheck, tests, and production build;
- add Wrangler configuration with local D1 and documented migrations;
- provide the exact Cloudflare dashboard steps needed to connect GitHub;
- acceptance: local checks pass and a public `workers.dev` hello-world URL
  deploys from `main`, with preview builds enabled for other branches.

### M1 — vertical slice of satellite mode

- nickname screen and mode selection;
- five-round state flow with a small fixture pool;
- responsive clue view and expanding MapLibre guess map using a coarse Natural
  Earth basemap suitable for country-scale satellite guesses;
- server-owned round selection, guess reveal, result line, distance, and score;
- final summary and play-again flow;
- tests for haversine, scoring, nickname validation, and API schemas;
- acceptance: a complete five-round satellite game works locally without an
  answer appearing in pre-guess browser resources.

This intentionally moves the minimal anti-cheat round API earlier than the
original M3. Building M1 as a purely static prototype would create throwaway
contracts and could accidentally establish an insecure asset format.

### M2 — metro data and mode

- fetch/cache OSM subway and light-rail data;
- normalize topology and generate local-coordinate excerpts;
- provide satellite terrain context without labels or transit overlays on the
  metro guessing map;
- validate that published clues contain no WGS84 coordinates or identifying
  properties;
- implement the Mini Metro-inspired renderer and the full five-round flow;
- acceptance: metro mode works end-to-end with real geometry and server-only
  answers.

### M3 — durable leaderboard and abuse controls

- finalize D1 schemas/indexes, game expiry, and cleanup;
- add automatic verified leaderboard insertion and top-ten screens;
- integrate Turnstile in production with documented local test keys;
- add a conservative Worker Rate Limiting binding for game creation;
- add API integration tests for replay, concurrent guesses, invalid state, and
  forged score attempts;
- acceptance: only completed server-verified games reach the ranking.

### M4 — production content and polish

- generate and curate three Sentinel-2 crops for each of 30 cities;
- accessibility, keyboard/touch behavior, light/dark themes, and mobile tuning;
- source/licensing page, visible attributions, provenance records, and data
  refresh instructions;
- end-to-end smoke tests, bundle/asset budget, final README and operations notes;
- acceptance: both modes, ranking, deployment, licenses, and anti-cheat checks
  meet the definition of done.

## User-owned setup steps

The following require the project owner and will be requested only when their
milestone is ready:

1. Create a private GitHub repository named `location-guessing-game` and confirm
   push permission.
2. Create a free Cloudflare account and authorize its GitHub integration.
3. Create/select the production and preview Workers and two separate D1 databases,
   then bind their IDs through the matching Wrangler environments.
4. Enable non-production branch builds and Worker preview URLs.
5. At M3, create a Turnstile widget and store its secret in Cloudflare; commit
   only the public site key/example variable names.
6. Review the 90 generated satellite clues and the attribution page before the
   first production release.

## Approval state

The decisions were accepted with the amendments recorded above. M0–M4 code is
implemented locally. External deployment still requires the owner-controlled
Cloudflare account actions listed above.
