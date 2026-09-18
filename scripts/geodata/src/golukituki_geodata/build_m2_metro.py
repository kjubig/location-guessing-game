"""Build anonymized metro clues from cached OpenStreetMap Overpass data.

Network access is an explicit acquisition step. Transformation and tests operate
on cached JSON so CI never depends on the public Overpass service.
"""

from __future__ import annotations

import hashlib
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
CITIES_PATH = REPOSITORY_ROOT / "data" / "cities.json"
RAW_DIRECTORY = REPOSITORY_ROOT / "data" / "raw" / "m2-metro"
MANIFEST_PATH = REPOSITORY_ROOT / "data" / "source" / "m2-metro-fixtures.json"
CLUE_DIRECTORY = REPOSITORY_ROOT / "apps" / "web" / "public" / "clues" / "metro"

OVERPASS_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
USER_AGENT = "GEOLUKITUKI-M2-metro-pipeline/1.0 (private learning project)"
EXCERPT_RADIUS_KM = 4.5
CANVAS_WIDTH = 1000
CANVAS_HEIGHT = 760


@dataclass(frozen=True)
class City:
    city_id: str
    latitude: float
    longitude: float


def read_cities() -> list[City]:
    catalog = json.loads(CITIES_PATH.read_text(encoding="utf-8"))
    return [
        City(
            city_id=city["id"],
            latitude=city["referenceLocation"]["latitude"],
            longitude=city["referenceLocation"]["longitude"],
        )
        for city in catalog["cities"]
    ]


def overpass_query(city: City, radius_degrees: float = 0.16) -> str:
    south = city.latitude - radius_degrees
    west = city.longitude - radius_degrees
    north = city.latitude + radius_degrees
    east = city.longitude + radius_degrees
    bounds = f"{south:.5f},{west:.5f},{north:.5f},{east:.5f}"
    return f"""[out:json][timeout:120];
(
  way[\"railway\"~\"^(subway|light_rail)$\"]({bounds});
  node[\"railway\"~\"^(station|halt|stop)$\"]({bounds});
  node[\"public_transport\"~\"^(station|stop_position)$\"][\"subway\"=\"yes\"]({bounds});
);
(._;>;);
out body;"""


def fetch_city(city: City, *, refresh: bool = False) -> Path:
    RAW_DIRECTORY.mkdir(parents=True, exist_ok=True)
    destination = RAW_DIRECTORY / f"{city.city_id}.json"
    if destination.exists() and not refresh:
        return destination

    encoded = urllib.parse.urlencode({"data": overpass_query(city)}).encode("utf-8")
    payload: bytes | None = None
    last_error: Exception | None = None
    for endpoint in OVERPASS_URLS:
        request = urllib.request.Request(
            endpoint,
            data=encoded,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": USER_AGENT,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                payload = response.read()
            break
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
            last_error = error
            time.sleep(2)
    if payload is None:
        raise RuntimeError(
            f"Every Overpass endpoint failed for {city.city_id}"
        ) from last_error
    parsed = json.loads(payload)
    if not parsed.get("elements"):
        raise RuntimeError(f"Overpass returned no metro data for {city.city_id}")
    destination.write_text(
        json.dumps(parsed, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return destination


def distance_km(
    latitude: float,
    longitude: float,
    center_latitude: float,
    center_longitude: float,
) -> float:
    north_km = (latitude - center_latitude) * 110.574
    east_km = (
        (longitude - center_longitude)
        * 111.320
        * math.cos(math.radians(center_latitude))
    )
    return math.hypot(east_km, north_km)


def local_point(
    latitude: float,
    longitude: float,
    center_latitude: float,
    center_longitude: float,
) -> list[int]:
    east_km = (
        (longitude - center_longitude)
        * 111.320
        * math.cos(math.radians(center_latitude))
    )
    north_km = (latitude - center_latitude) * 110.574
    scale = min(CANVAS_WIDTH, CANVAS_HEIGHT) / (EXCERPT_RADIUS_KM * 2.2)
    return [
        round(CANVAS_WIDTH / 2 + east_km * scale),
        round(CANVAS_HEIGHT / 2 - north_km * scale),
    ]


def is_station(tags: dict[str, str]) -> bool:
    return tags.get("railway") in {"station", "halt", "stop"} or (
        tags.get("subway") == "yes"
        and tags.get("public_transport") in {"station", "stop_position"}
    )


def merge_nearby_points(points: set[tuple[int, int]], minimum_gap: int = 18) -> list[list[int]]:
    merged: list[tuple[int, int]] = []
    for point in sorted(points):
        if all(math.dist(point, existing) >= minimum_gap for existing in merged):
            merged.append(point)
    return [list(point) for point in merged]


def build_public_clue(source: dict[str, Any], city: City) -> tuple[dict[str, Any], dict[str, Any]]:
    elements = source.get("elements", [])
    nodes = {
        int(element["id"]): element
        for element in elements
        if element.get("type") == "node"
        and isinstance(element.get("lat"), (int, float))
        and isinstance(element.get("lon"), (int, float))
    }
    ways = [
        element
        for element in elements
        if element.get("type") == "way"
        and element.get("tags", {}).get("railway") in {"subway", "light_rail"}
    ]
    metro_node_ids = {
        int(node_id)
        for way in ways
        for node_id in way.get("nodes", [])
        if int(node_id) in nodes
    }
    metro_nodes = [nodes[node_id] for node_id in metro_node_ids]
    tagged_stations = [
        node for node in nodes.values() if is_station(node.get("tags", {}))
    ]
    station_nodes = [
        station
        for station in tagged_stations
        if any(
            distance_km(
                station["lat"],
                station["lon"],
                network_node["lat"],
                network_node["lon"],
            )
            <= 0.35
            for network_node in metro_nodes
        )
    ]
    if not station_nodes:
        station_nodes = tagged_stations
    anchor_candidates = station_nodes or list(nodes.values())
    if not ways or not anchor_candidates:
        raise RuntimeError(f"Incomplete metro geometry for {city.city_id}")

    anchor = min(
        anchor_candidates,
        key=lambda node: distance_km(
            node["lat"], node["lon"], city.latitude, city.longitude
        ),
    )
    center_latitude = float(anchor["lat"])
    center_longitude = float(anchor["lon"])

    lines: list[dict[str, list[list[int]]]] = []
    for way in ways:
        run: list[list[int]] = []
        for node_id in way.get("nodes", []):
            node = nodes.get(int(node_id))
            inside = node is not None and distance_km(
                node["lat"],
                node["lon"],
                center_latitude,
                center_longitude,
            ) <= EXCERPT_RADIUS_KM * 1.1
            if inside:
                point = local_point(
                    node["lat"],
                    node["lon"],
                    center_latitude,
                    center_longitude,
                )
                if not run or point != run[-1]:
                    run.append(point)
            elif len(run) >= 2:
                lines.append({"points": run})
                run = []
            else:
                run = []
        if len(run) >= 2:
            lines.append({"points": run})

    stations = merge_nearby_points(
        {
            tuple(
                local_point(
                    node["lat"],
                    node["lon"],
                    center_latitude,
                    center_longitude,
                )
            )
            for node in station_nodes
            if distance_km(
                node["lat"], node["lon"], center_latitude, center_longitude
            )
            <= EXCERPT_RADIUS_KM
        }
    )
    if not lines:
        raise RuntimeError(f"No connected metro lines near anchor for {city.city_id}")

    public_clue = {
        "schemaVersion": 1,
        "canvas": {"width": CANVAS_WIDTH, "height": CANVAS_HEIGHT},
        "lines": lines,
        "stations": stations,
    }
    private_metadata = {
        "answerLocation": {
            "latitude": round(center_latitude, 7),
            "longitude": round(center_longitude, 7),
        },
        "anchorOsmNode": int(anchor["id"]),
        "lineCount": len(lines),
        "stationCount": len(stations),
    }
    return public_clue, private_metadata


def validate_public_clue(clue: dict[str, Any]) -> None:
    serialized = json.dumps(clue, separators=(",", ":")).lower()
    forbidden = ("latitude", "longitude", "city", "name", "osm", "126.", "127.", "128.", "129.")
    if any(value in serialized for value in forbidden):
        raise ValueError("Public metro clue contains identifying or geographic data")
    if clue.get("schemaVersion") != 1 or not clue.get("lines"):
        raise ValueError("Public metro clue is missing required geometry")
    for line in clue["lines"]:
        if len(line.get("points", [])) < 2:
            raise ValueError("Every metro line needs at least two points")
        for x, y in line["points"]:
            if not (-100 <= x <= CANVAS_WIDTH + 100 and -100 <= y <= CANVAS_HEIGHT + 100):
                raise ValueError("Metro clue coordinate is outside the drawing canvas")


def build_city(city: City, *, refresh: bool = False) -> dict[str, Any]:
    source_path = fetch_city(city, refresh=refresh)
    source_bytes = source_path.read_bytes()
    source = json.loads(source_bytes)
    clue, private_metadata = build_public_clue(source, city)
    validate_public_clue(clue)

    source_checksum = hashlib.sha256(source_bytes).hexdigest()
    asset_id = hashlib.sha256(
        f"{city.city_id}:{private_metadata['anchorOsmNode']}:{source_checksum}".encode()
    ).hexdigest()[:20]
    CLUE_DIRECTORY.mkdir(parents=True, exist_ok=True)
    clue_path = CLUE_DIRECTORY / f"{asset_id}.json"
    clue_path.write_text(
        json.dumps(clue, separators=(",", ":")),
        encoding="utf-8",
    )
    return {
        "assetId": asset_id,
        "cityId": city.city_id,
        "publicPath": f"/clues/metro/{asset_id}.json",
        **private_metadata,
        "source": {
            "provider": "OpenStreetMap contributors via Overpass API",
            "license": "ODbL 1.0",
            "rawSha256": source_checksum,
            "query": overpass_query(city),
        },
    }


def main() -> None:
    fixtures = []
    cities = read_cities()
    for index, city in enumerate(cities):
        was_cached = (RAW_DIRECTORY / f"{city.city_id}.json").exists()
        fixtures.append(build_city(city))
        if not was_cached and index < len(cities) - 1:
            time.sleep(4)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    manifest = {
        "schemaVersion": 1,
        "generatedAt": "2026-09-18",
        "purpose": "M2 metro development fixture pool",
        "excerptRadiusKm": EXCERPT_RADIUS_KM,
        "fixtures": fixtures,
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    generated_names = {Path(fixture["publicPath"]).name for fixture in fixtures}
    for path in CLUE_DIRECTORY.glob("*.json"):
        if path.name not in generated_names:
            path.unlink()
    print(f"Wrote {len(fixtures)} metro fixtures to {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
