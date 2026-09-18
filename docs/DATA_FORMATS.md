# Data formats

## City catalog

`data/cities.json` is the reviewed list of playable cities. Its JSON Schema is
`data/cities.schema.json`.

Each city contains:

- `id`: stable lowercase identifier used by pipelines and D1;
- `name.en`: English transliteration;
- `name.ko`: Hangul name;
- `referenceLocation`: a catalog reference point, not automatically a clue answer;
- `clueAssetIds`: opaque IDs of generated crops available for that city.

Every generated satellite clue has its own answer equal to the center of the
displayed crop. Crop bounds, source product, acquisition date, and answer stay in
the ignored `data/generated` manifest and are seeded into D1. They are not added
to the public web asset directory.

## Opaque asset IDs

Asset IDs must not contain a city, station, line, or coordinate. The pipeline
will generate random UUID-like IDs and place only the optimized media file under
`apps/web/public/clues`.
