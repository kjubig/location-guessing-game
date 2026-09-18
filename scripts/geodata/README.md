# Geodata workspace

This Python project owns offline transformations only. It must never become a
runtime dependency of the website or Worker.

The project remains dependency-free and tests with the Python standard library.
The verified Planetary Computer flow renders WebP remotely, so M4 did not need
`uv`, GDAL, rasterio, or Pillow. Dependencies should be added only when a future
transformation actually uses them.

Planned responsibilities:

- validate and enrich the city catalog;
- produce Natural Earth map data;
- acquire and normalize OSM metro geometry;
- produce the small Natural Earth country outline;
- prepare and validate Sentinel-2 WebP clues;
- strip metadata and detect answer leaks in published files.

## M1 development fixtures

The first satellite fixture fetcher needs no third-party Python package. From
the repository root run:

```powershell
python -m scripts.geodata.src.golukituki_geodata.fetch_m1_fixtures
```

It queries Microsoft Planetary Computer's STAC API for low-cloud Sentinel-2 L2A
items, saves opaque rendered tiles in `apps/web/public/clues`, and writes their
source metadata plus exact tile-center answers to
`data/source/m1-satellite-fixtures.json`. It also extracts South Korea from the
public-domain Natural Earth country dataset for the guessing map.

The M1 pipeline deliberately uses only Python's standard library. Installing
`uv` before the raster-processing work in M4 would add a tool without using its
main benefit: locking external Python dependencies.

## M2 metro fixtures

The metro pipeline also uses the standard library. It downloads bounded OSM
responses once, caches them in ignored `data/raw/m2-metro/`, and transforms real
geometry into anonymous local drawing coordinates:

```powershell
python -m scripts.geodata.src.golukituki_geodata.build_m2_metro
```

Generated browser files contain only integer canvas points. Real answer
coordinates, the Overpass query, and the raw-response checksum remain in
`data/source/m2-metro-fixtures.json`. CI exercises only the deterministic
transformation and never sends requests to Overpass.

## M4 satellite pool

The production-size generator reads the 30-city GeoNames-backed catalogue,
selects three globally unique zoom-12 tiles per city, pins low-cloud Sentinel-2
L2A items, and downloads 512 px true-colour WebP renders:

```powershell
python -m scripts.geodata.src.golukituki_geodata.build_m4_satellite
```

It writes public opaque images, the private-repository provenance manifest
`data/source/m4-satellite-fixtures.json`, city asset IDs, and migration `0005`.
An ordinary repeat uses pinned sources and cached files. Use
`--refresh-selection` only when intentionally changing imagery, then visually
review every changed clue. See `docs/milestones/M4.md` for the full algorithm,
failure notes, licences, and release procedure.
