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
