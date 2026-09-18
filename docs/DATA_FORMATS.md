# Data formats

## City catalog

`data/cities.json` is the reviewed list of playable cities. Its JSON Schema is
`data/cities.schema.json`.

Each city contains:

- `id`: stable lowercase identifier used by pipelines and D1;
- `name.en`: English transliteration;
- `name.ko`: Hangul name;
- `referenceLocation`: a catalog reference point, not automatically a clue answer;
- `source`: catalogue provider and its stable record ID;
- `clueAssetIds`: opaque IDs of generated crops available for that city.

Every generated satellite clue has its own answer equal to the center of the
displayed crop. Tile address, source product, acquisition date, checksum, and
answer stay in `data/source/m4-satellite-fixtures.json` in the private
repository and are seeded into D1. Only the image itself is added to the public
web asset directory.

## Opaque asset IDs

Asset IDs must not contain a city, station, line, or coordinate. The M4 pipeline
uses the first 20 hexadecimal characters of a SHA-256 over the pinned source
item and tile address. This is opaque to a player while remaining deterministic.
Only the optimized media file is placed under `apps/web/public/clues`.

## Satellite provenance manifest

The M4 manifest is schema-versioned and records selection parameters plus one
fixture per public image. Each fixture contains `assetId`, `cityId`, `variant`,
`publicPath`, the exact `answerLocation`, SHA-256, byte count, Sentinel item
metadata, required attribution, and Web Mercator tile coordinates. It is a
build/review record, never a frontend asset.

## Metro clue

Metro clues use versioned JSON rather than geographic GeoJSON. A browser file
contains an abstract canvas plus anonymous line and station coordinates:

```json
{
  "schemaVersion": 1,
  "canvas": { "width": 1000, "height": 760 },
  "lines": [
    {
      "points": [
        [120, 300],
        [350, 410]
      ]
    }
  ],
  "stations": [
    [120, 300],
    [350, 410]
  ]
}
```

The numbers are integer drawing units created after projection, translation,
and scaling. They are not longitude/latitude and the object contains no city,
line, station, OSM ID, tag, or name. The corresponding real answer and raw OSM
checksum live only in `data/source/m2-metro-fixtures.json` and the D1 seed.
