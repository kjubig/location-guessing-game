"""Build the label-free South Korea overlay used by the satellite guess map.

MapLibre normally turns GeoJSON into WebGL geometry in a browser worker.  The
production application encountered a browser-specific failure in that path, so
the satellite mode uses this pre-rendered SVG as a deliberately small fallback.
The coordinates are converted to Web Mercator, matching MapLibre's projection.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Iterable


REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
SOURCE_PATH = REPOSITORY_ROOT / "apps" / "web" / "public" / "map" / "south-korea.geojson"
OUTPUT_PATH = (
    REPOSITORY_ROOT
    / "apps"
    / "web"
    / "public"
    / "map"
    / "south-korea-overlay.svg"
)
VIEWBOX_SIZE = 1000


def polygon_rings(geometry: dict[str, Any]) -> Iterable[list[list[float]]]:
    """Yield all exterior and interior rings from Polygon/MultiPolygon data."""
    if geometry["type"] == "Polygon":
        yield from geometry["coordinates"]
        return
    if geometry["type"] == "MultiPolygon":
        for polygon in geometry["coordinates"]:
            yield from polygon
        return
    raise ValueError(f"Unsupported geometry type: {geometry['type']}")


def mercator_y(latitude: float) -> float:
    """Return the unscaled Web Mercator Y coordinate for a latitude."""
    radians = math.radians(latitude)
    return math.log(math.tan(math.pi / 4 + radians / 2))


def build_svg(source: dict[str, Any]) -> tuple[str, tuple[float, float, float, float]]:
    rings = [
        ring
        for feature in source["features"]
        for ring in polygon_rings(feature["geometry"])
    ]
    points = [point for ring in rings for point in ring]
    west = min(point[0] for point in points)
    south = min(point[1] for point in points)
    east = max(point[0] for point in points)
    north = max(point[1] for point in points)
    mercator_north = mercator_y(north)
    mercator_south = mercator_y(south)

    def project(point: list[float]) -> tuple[float, float]:
        longitude, latitude = point
        x = (longitude - west) / (east - west) * VIEWBOX_SIZE
        y = (mercator_north - mercator_y(latitude)) / (
            mercator_north - mercator_south
        ) * VIEWBOX_SIZE
        return x, y

    paths: list[str] = []
    for ring in rings:
        projected = [project(point) for point in ring]
        commands = [f"M{projected[0][0]:.3f},{projected[0][1]:.3f}"]
        commands.extend(f"L{x:.3f},{y:.3f}" for x, y in projected[1:])
        commands.append("Z")
        paths.append(" ".join(commands))

    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {VIEWBOX_SIZE} {VIEWBOX_SIZE}" preserveAspectRatio="none">\n'
        '  <path d="'
        + " ".join(paths)
        + '" fill="#f2ead8" fill-opacity="0.97" fill-rule="evenodd" '
        'stroke="#173d31" stroke-width="3" vector-effect="non-scaling-stroke"/>\n'
        "</svg>\n"
    )
    return svg, (west, south, east, north)


def main() -> None:
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    svg, bounds = build_svg(source)
    OUTPUT_PATH.write_text(svg, encoding="utf-8", newline="\n")
    west, south, east, north = bounds
    print(
        f"Wrote {OUTPUT_PATH.relative_to(REPOSITORY_ROOT)} "
        f"for bounds west={west}, south={south}, east={east}, north={north}"
    )


if __name__ == "__main__":
    main()
