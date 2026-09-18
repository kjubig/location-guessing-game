"""Fetch the reproducible M1 satellite fixture set with the standard library."""

from __future__ import annotations

import hashlib
import json
import math
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
CITIES_PATH = REPOSITORY_ROOT / "data" / "cities.json"
MANIFEST_PATH = REPOSITORY_ROOT / "data" / "source" / "m1-satellite-fixtures.json"
CLUE_DIRECTORY = REPOSITORY_ROOT / "apps" / "web" / "public" / "clues"
MAP_PATH = REPOSITORY_ROOT / "apps" / "web" / "public" / "map" / "south-korea.geojson"

STAC_SEARCH_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
NATURAL_EARTH_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/"
    "geojson/ne_10m_admin_0_countries.geojson"
)
ZOOM = 12
DATE_RANGE = "2024-01-01/2025-12-31"
MAX_CLOUD_COVER = 15


@dataclass(frozen=True)
class City:
    city_id: str
    latitude: float
    longitude: float


def request_json(url: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8") if payload else None
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "GEOLUKITUKI-M1-fixture-pipeline/1.0",
        },
        method="POST" if payload else "GET",
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


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


def web_mercator_tile(longitude: float, latitude: float, zoom: int) -> tuple[int, int]:
    scale = 2**zoom
    x = math.floor((longitude + 180) / 360 * scale)
    latitude_radians = math.radians(latitude)
    y = math.floor(
        (1 - math.asinh(math.tan(latitude_radians)) / math.pi) / 2 * scale
    )
    return x, y


def tile_center(x: int, y: int, zoom: int) -> tuple[float, float]:
    scale = 2**zoom
    longitude = (x + 0.5) / scale * 360 - 180
    latitude = math.degrees(
        math.atan(math.sinh(math.pi * (1 - 2 * (y + 0.5) / scale)))
    )
    return latitude, longitude


def select_item(city: City) -> dict[str, Any]:
    search = request_json(
        STAC_SEARCH_URL,
        {
            "collections": ["sentinel-2-l2a"],
            "intersects": {
                "type": "Point",
                "coordinates": [city.longitude, city.latitude],
            },
            "datetime": DATE_RANGE,
            "limit": 50,
            "query": {"eo:cloud_cover": {"lt": MAX_CLOUD_COVER}},
        },
    )
    features = search.get("features", [])
    if not features:
        raise RuntimeError(f"No suitable Sentinel-2 item found for {city.city_id}")
    return min(
        features,
        key=lambda feature: float(feature["properties"].get("eo:cloud_cover", 100)),
    )


def download_city_fixture(city: City) -> dict[str, Any]:
    item = select_item(city)
    item_id = item["id"]
    tilejson = request_json(item["assets"]["tilejson"]["href"])
    tile_template = tilejson["tiles"][0].replace("@1x", "@2x")
    x, y = web_mercator_tile(city.longitude, city.latitude, ZOOM)
    tile_url = (
        tile_template.replace("{z}", str(ZOOM))
        .replace("{x}", str(x))
        .replace("{y}", str(y))
    )
    asset_id = hashlib.sha256(f"{item_id}:{ZOOM}:{x}:{y}".encode()).hexdigest()[:20]
    asset_path = CLUE_DIRECTORY / f"{asset_id}.png"

    request = urllib.request.Request(
        tile_url,
        headers={"User-Agent": "GEOLUKITUKI-M1-fixture-pipeline/1.0"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        image = response.read()
        content_type = response.headers.get_content_type()
    if content_type != "image/png" or not image.startswith(b"\x89PNG"):
        raise RuntimeError(f"Unexpected tile response for {city.city_id}: {content_type}")
    asset_path.write_bytes(image)

    answer_latitude, answer_longitude = tile_center(x, y, ZOOM)
    properties = item["properties"]
    return {
        "assetId": asset_id,
        "cityId": city.city_id,
        "publicPath": f"/clues/{asset_id}.png",
        "answerLocation": {
            "latitude": round(answer_latitude, 7),
            "longitude": round(answer_longitude, 7),
        },
        "source": {
            "collection": "sentinel-2-l2a",
            "itemId": item_id,
            "acquiredAt": properties["datetime"],
            "cloudCover": properties.get("eo:cloud_cover"),
            "provider": "Microsoft Planetary Computer",
            "attribution": "Contains modified Copernicus Sentinel data",
        },
        "tile": {"zoom": ZOOM, "x": x, "y": y},
    }


def download_south_korea_boundary() -> None:
    dataset = request_json(NATURAL_EARTH_URL)
    feature = next(
        candidate
        for candidate in dataset["features"]
        if candidate["properties"].get("ADM0_A3") == "KOR"
    )
    minimal_feature = {
        "type": "Feature",
        "properties": {"name": "South Korea", "source": "Natural Earth"},
        "geometry": feature["geometry"],
    }
    MAP_PATH.write_text(
        json.dumps(
            {"type": "FeatureCollection", "features": [minimal_feature]},
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )


def main() -> None:
    CLUE_DIRECTORY.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MAP_PATH.parent.mkdir(parents=True, exist_ok=True)

    fixtures = [download_city_fixture(city) for city in read_cities()]
    manifest = {
        "schemaVersion": 1,
        "generatedAt": "2026-09-18",
        "purpose": "M1 development fixture pool",
        "fixtures": fixtures,
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    download_south_korea_boundary()
    print(f"Wrote {len(fixtures)} fixtures to {MANIFEST_PATH}")
    print(f"Wrote Natural Earth boundary to {MAP_PATH}")


if __name__ == "__main__":
    main()
