# Release checklist

Use this list on a preview URL before promoting the first production release.
Automated tests reduce risk, but they do not replace the browser and data review.

## Local gate

```powershell
pnpm db:migrate:local
pnpm validate
pnpm pipeline:test
```

- `data/source/m4-satellite-fixtures.json` contains 90 records and each public
  file hash matches;
- production build contains no `.map`, `.env`, raw OSM, provenance manifest, or
  source-coordinate file;
- no file exceeds 25 MiB, the public file count stays below 20,000, and M4 WebP
  imagery stays within its 10 MiB project budget;
- the migration leaves five enabled metro and 90 enabled satellite assets.

## Preview data and security

- `/api/health` reports `preview`;
- preview and production Wrangler environments contain different D1 IDs and
  Rate Limiting namespaces;
- a game response before the first guess exposes `clueUrl`, but no answer,
  distance, score, source ID, or city name;
- submitting an answer/score field cannot change server scoring;
- a repeated guess for the same round is rejected;
- an invalid, expired, or reused Turnstile token is rejected;
- bursts above the configured start limit return `429`;
- logs contain no nickname, game ID/URL, token, IP, body, guess, or answer;
- a completed preview game appears only in the preview leaderboard.

## Browser smoke test

Run once in current Chrome/Edge and one mobile-sized/touch browser:

- start and finish five satellite rounds;
- start and finish five metro rounds;
- verify satellite clues use the blank outline and metro guesses use the
  satellite context without labels;
- pan/zoom with pointer and keyboard, select the map centre with keyboard, open
  and close the expanded map with Escape;
- reload an unfinished game and finish it;
- switch language and light/dark theme;
- check loading, empty ranking, validation, offline/API, and image-error states;
- enable reduced motion and confirm result-map movement is immediate;
- open every source/licence link and confirm visible attributions.

## Human content and scoring review

- inspect all 90 satellite images for clouds, black/blank pixels, water-only
  views, snow/haze, seams, accidental labels, and recognisability;
- play structured sessions with several people and record round distance and
  subjective difficulty;
- change the 50 km satellite or 8 km metro scale only from those observations,
  then update tests and milestone notes;
- confirm EOxCloudless use remains non-commercial or replace/license it before
  a commercial release.

## Promotion and rollback readiness

- export production D1 outside the repository;
- apply migrations to preview and smoke-test it before production;
- apply the compatible production migration immediately before deploy;
- confirm GitHub CI and Cloudflare build are green;
- keep the previous Worker version available and use `git revert` for code
  rollback; never blindly reverse a D1 migration.
