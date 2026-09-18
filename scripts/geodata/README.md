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
