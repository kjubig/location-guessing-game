# Geodata workspace

This Python project owns offline transformations only. It must never become a
runtime dependency of the website or Worker.

M0 keeps the project dependency-free and tests it with the Python standard
library. `uv` and GIS/raster libraries will be installed when M1/M2 first needs
them, with the exact command and reason recorded in that milestone journal.

Planned responsibilities:

- validate and enrich the city catalog;
- produce Natural Earth map data;
- acquire and normalize OSM metro geometry;
- create filtered vector tiles;
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
