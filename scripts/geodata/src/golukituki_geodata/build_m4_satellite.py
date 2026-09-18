"""Build the curated M4 Sentinel-2 clue pool without third-party packages."""

from __future__ import annotations

import argparse
import hashlib
import json
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from .fetch_m1_fixtures import tile_center, web_mercator_tile


REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
CITIES_PATH = REPOSITORY_ROOT / "data" / "cities.json"
MANIFEST_PATH = REPOSITORY_ROOT / "data" / "source" / "m4-satellite-fixtures.json"
CLUE_DIRECTORY = REPOSITORY_ROOT / "apps" / "web" / "public" / "clues"
MIGRATION_PATH = REPOSITORY_ROOT / "migrations" / "0005_m4_satellite_content.sql"

STAC_SEARCH_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
TILE_BASE_URL = (
    "https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/"
    "WebMercatorQuad"
)
ZOOM = 12
DATE_RANGE = "2024-01-01/2025-12-31"
MAX_CLOUD_COVER = 15
MIN_PUBLIC_WEBP_BYTES = 8 * 1024
CANDIDATE_OFFSETS = (
    (0, 0),
    (1, 0),
    (-1, 1),
    (0, 1),
    (-1, 0),
    (0, -1),
    (1, 1),
    (1, -1),
    (-1, -1),
    (2, 0),
    (0, 2),
    (-2, 0),
    (0, -2),
    (2, 1),
    (1, 2),
    (-1, 2),
    (-2, 1),
    (-2, -1),
    (-1, -2),
    (1, -2),
    (2, -1),
    (2, 2),
    (-2, 2),
    (-2, -2),
    (2, -2),
)
COASTAL_LANDWARD_OFFSETS = {
    "busan": ((0, 0), (-1, 0), (0, -1), (-1, -1)),
    "geoje": ((0, 0), (-1, 0), (0, -1), (-1, -1)),
}
FORBIDDEN_WEBP_CHUNKS = {b"EXIF", b"XMP "}


@dataclass(frozen=True)
class City:
    city_id: str
    latitude: float
    longitude: float


@dataclass(frozen=True)
class SourceItem:
    acquired_at: str
    cloud_cover: float
    item_id: str


@dataclass(frozen=True)
class TileSpec:
    x: int
    y: int
    zoom: int


def request_json(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "GEOLUKITUKI-M4-content-pipeline/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def read_cities() -> list[City]:
    catalog = json.loads(CITIES_PATH.read_text(encoding="utf-8"))
    return [
        City(
            city_id=entry["id"],
            latitude=entry["referenceLocation"]["latitude"],
            longitude=entry["referenceLocation"]["longitude"],
        )
        for entry in catalog["cities"]
    ]


def read_existing_sources() -> dict[tuple[str, int, int, int], SourceItem]:
    if not MANIFEST_PATH.exists():
        return {}
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    sources: dict[tuple[str, int, int, int], SourceItem] = {}
    for fixture in manifest.get("fixtures", []):
        source = fixture["source"]
        sources.setdefault(
            (
                fixture["cityId"],
                int(fixture["tile"]["zoom"]),
                int(fixture["tile"]["x"]),
                int(fixture["tile"]["y"]),
            ),
            SourceItem(
                acquired_at=source["acquiredAt"],
                cloud_cover=float(source["cloudCover"]),
                item_id=source["itemId"],
            ),
        )
    return sources


def select_item(city_id: str, tile: TileSpec) -> SourceItem:
    latitude, longitude = tile_center(tile.x, tile.y, tile.zoom)
    search = request_json(
        STAC_SEARCH_URL,
        {
            "collections": ["sentinel-2-l2a"],
            "intersects": {
                "type": "Point",
                "coordinates": [longitude, latitude],
            },
            "datetime": DATE_RANGE,
            "limit": 50,
            "query": {"eo:cloud_cover": {"lt": MAX_CLOUD_COVER}},
        },
    )
    features = [
        feature
        for feature in search.get("features", [])
        if "visual" in feature.get("assets", {})
        and item_covers_tiles(feature.get("bbox", []), [tile])
    ]
    if not features:
        raise RuntimeError(f"No suitable Sentinel-2 item found for {city_id}")
    item = min(
        features,
        key=lambda feature: (
            float(feature["properties"].get("eo:cloud_cover", 100)),
            feature["id"],
        ),
    )
    return SourceItem(
        acquired_at=item["properties"]["datetime"],
        cloud_cover=float(item["properties"].get("eo:cloud_cover", 100)),
        item_id=item["id"],
    )


def item_covers_tiles(bbox: list[float], tiles: list[TileSpec]) -> bool:
    if len(bbox) < 4:
        return False
    west, south, east, north = bbox[:4]
    return all(
        west <= longitude <= east and south <= latitude <= north
        for latitude, longitude in (
            tile_center(tile.x, tile.y, tile.zoom) for tile in tiles
        )
    )


def tile_specs(
    city: City, reserved: set[tuple[int, int, int]] | None = None
) -> list[TileSpec]:
    used = reserved if reserved is not None else set()
    selected: list[TileSpec] = []
    for tile in candidate_tiles(city, used):
        selected.append(tile)
        used.add((tile.zoom, tile.x, tile.y))
        if len(selected) == 3:
            return selected
    raise RuntimeError(f"Could not allocate three unique tiles for {city.city_id}")


def candidate_tiles(
    city: City, reserved: set[tuple[int, int, int]]
) -> list[TileSpec]:
    center_x, center_y = web_mercator_tile(city.longitude, city.latitude, ZOOM)
    candidates: list[TileSpec] = []
    preferred = COASTAL_LANDWARD_OFFSETS.get(city.city_id, ())
    offsets = preferred + tuple(
        offset for offset in CANDIDATE_OFFSETS if offset not in preferred
    )
    for offset_x, offset_y in offsets:
        tile = TileSpec(x=center_x + offset_x, y=center_y + offset_y, zoom=ZOOM)
        key = (tile.zoom, tile.x, tile.y)
        if key in reserved:
            continue
        candidates.append(tile)
    return candidates


def asset_id(source: SourceItem, tile: TileSpec) -> str:
    material = f"{source.item_id}:{tile.zoom}:{tile.x}:{tile.y}:webp@2x"
    return hashlib.sha256(material.encode()).hexdigest()[:20]


def tile_url(source: SourceItem, tile: TileSpec) -> str:
    query = urllib.parse.urlencode(
        {
            "collection": "sentinel-2-l2a",
            "item": source.item_id,
            "assets": "visual",
            "asset_bidx": "visual|1,2,3",
            "nodata": "0",
            "format": "webp",
        }
    )
    return f"{TILE_BASE_URL}/{tile.zoom}/{tile.x}/{tile.y}@2x?{query}"


def webp_chunk_names(payload: bytes) -> list[bytes]:
    if len(payload) < 20 or payload[:4] != b"RIFF" or payload[8:12] != b"WEBP":
        raise ValueError("Asset is not a RIFF WebP image")
    names: list[bytes] = []
    position = 12
    while position + 8 <= len(payload):
        name = payload[position : position + 4]
        size = int.from_bytes(payload[position + 4 : position + 8], "little")
        names.append(name)
        position += 8 + size + (size % 2)
    return names


def validate_public_webp(payload: bytes) -> None:
    chunks = set(webp_chunk_names(payload))
    forbidden = chunks.intersection(FORBIDDEN_WEBP_CHUNKS)
    if forbidden:
        names = ", ".join(name.decode("ascii") for name in sorted(forbidden))
        raise ValueError(f"Public WebP contains forbidden metadata chunks: {names}")


def download_asset(source: SourceItem, tile: TileSpec, destination: Path) -> bytes:
    if destination.exists():
        payload = destination.read_bytes()
        validate_public_webp(payload)
        return payload

    request = urllib.request.Request(
        tile_url(source, tile),
        headers={"User-Agent": "GEOLUKITUKI-M4-content-pipeline/1.0"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = response.read()
        content_type = response.headers.get_content_type()
    if content_type != "image/webp":
        raise RuntimeError(f"Expected image/webp, received {content_type}")
    validate_public_webp(payload)
    destination.write_bytes(payload)
    return payload


def build_city(city: City, sources: list[SourceItem]) -> list[dict[str, Any]]:
    return build_city_tiles(city, tile_specs(city), sources)


def build_city_tiles(
    city: City, tiles: list[TileSpec], sources: list[SourceItem]
) -> list[dict[str, Any]]:
    return [
        build_fixture(city, index, tile, source)
        for index, (tile, source) in enumerate(
            zip(tiles, sources, strict=True), start=1
        )
    ]


def build_fixture(
    city: City, variant: int, tile: TileSpec, source: SourceItem
) -> dict[str, Any]:
    identifier = asset_id(source, tile)
    destination = CLUE_DIRECTORY / f"{identifier}.webp"
    payload = download_asset(source, tile, destination)
    latitude, longitude = tile_center(tile.x, tile.y, tile.zoom)
    year = source.acquired_at[:4]
    return {
        "assetId": identifier,
        "cityId": city.city_id,
        "variant": variant,
        "publicPath": f"/clues/{identifier}.webp",
        "answerLocation": {
            "latitude": round(latitude, 7),
            "longitude": round(longitude, 7),
        },
        "sha256": hashlib.sha256(payload).hexdigest(),
        "bytes": len(payload),
        "source": {
            "collection": "sentinel-2-l2a",
            "itemId": source.item_id,
            "acquiredAt": source.acquired_at,
            "cloudCover": source.cloud_cover,
            "provider": "Microsoft Planetary Computer",
            "attribution": f"Contains modified Copernicus Sentinel data ({year})",
        },
        "tile": {"zoom": tile.zoom, "x": tile.x, "y": tile.y},
    }


def sql_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def write_migration(fixtures: list[dict[str, Any]]) -> None:
    rows = []
    for fixture in fixtures:
        answer = fixture["answerLocation"]
        source = fixture["source"]
        source_reference = (
            f"planetary-computer:{source['itemId']}:"
            f"{fixture['tile']['zoom']}/{fixture['tile']['x']}/{fixture['tile']['y']}"
        )
        rows.append(
            "  ("
            + ", ".join(
                [
                    sql_string(fixture["assetId"]),
                    "'satellite'",
                    sql_string(fixture["publicPath"]),
                    str(answer["latitude"]),
                    str(answer["longitude"]),
                    sql_string(source["attribution"]),
                    sql_string(source_reference),
                ]
            )
            + ")"
        )

    sql = """-- Generated by build_m4_satellite.py. Answers remain server-side in D1.
UPDATE round_assets SET enabled = 0 WHERE mode = 'satellite';

INSERT INTO round_assets (
  id, mode, clue_path, answer_latitude, answer_longitude,
  attribution, source_reference
)
VALUES
"""
    sql += ",\n".join(rows)
    sql += """
ON CONFLICT(id) DO UPDATE SET
  clue_path = excluded.clue_path,
  answer_latitude = excluded.answer_latitude,
  answer_longitude = excluded.answer_longitude,
  attribution = excluded.attribution,
  source_reference = excluded.source_reference,
  enabled = 1;

UPDATE app_metadata
SET value = 'm4', updated_at = CURRENT_TIMESTAMP
WHERE key = 'schema_version';
"""
    MIGRATION_PATH.write_text(sql, encoding="utf-8")


def write_city_asset_ids(fixtures: list[dict[str, Any]]) -> None:
    catalog = json.loads(CITIES_PATH.read_text(encoding="utf-8"))
    identifiers: dict[str, list[str]] = {}
    for fixture in fixtures:
        identifiers.setdefault(fixture["cityId"], []).append(fixture["assetId"])
    for city in catalog["cities"]:
        city["clueAssetIds"] = identifiers.get(city["id"], [])
    CITIES_PATH.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def remove_stale_webp(expected_asset_ids: set[str]) -> int:
    removed = 0
    for path in CLUE_DIRECTORY.glob("*.webp"):
        if (
            len(path.stem) == 20
            and all(character in "0123456789abcdef" for character in path.stem)
            and path.stem not in expected_asset_ids
        ):
            path.unlink()
            removed += 1
    return removed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--refresh-selection",
        action="store_true",
        help="Ignore pinned manifest item IDs and repeat STAC selection.",
    )
    args = parser.parse_args()

    CLUE_DIRECTORY.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    existing_sources = {} if args.refresh_selection else read_existing_sources()
    selection_cache: dict[tuple[int, int, int], SourceItem] = {}

    fixtures: list[dict[str, Any]] = []
    cities = read_cities()
    reserved_tiles: set[tuple[int, int, int]] = set()
    for index, city in enumerate(cities, start=1):
        city_fixtures: list[dict[str, Any]] = []
        made_selection = False
        for tile in candidate_tiles(city, reserved_tiles):
            variant = len(city_fixtures) + 1
            source = existing_sources.get(
                (city.city_id, tile.zoom, tile.x, tile.y)
            )
            if source is None:
                cache_key = (tile.zoom, tile.x, tile.y)
                source = selection_cache.get(cache_key)
                if source is None:
                    source = select_item(city.city_id, tile)
                    selection_cache[cache_key] = source
                made_selection = True
            fixture = build_fixture(city, variant, tile, source)
            if fixture["bytes"] < MIN_PUBLIC_WEBP_BYTES:
                print(
                    f"  rejected {tile.zoom}/{tile.x}/{tile.y}: "
                    f"only {fixture['bytes']} bytes"
                )
                continue
            city_fixtures.append(fixture)
            reserved_tiles.add((tile.zoom, tile.x, tile.y))
            if len(city_fixtures) == 3:
                break
        if len(city_fixtures) != 3:
            raise RuntimeError(f"Could not build three useful clues for {city.city_id}")
        fixtures.extend(city_fixtures)
        print(f"[{index:02}/{len(cities)}] {city.city_id}: {len(city_fixtures)} clues")
        if made_selection:
            time.sleep(0.15)

    manifest = {
        "schemaVersion": 1,
        "generatedAt": date.today().isoformat(),
        "purpose": "M4 production satellite clue pool",
        "selection": {
            "dateRange": DATE_RANGE,
            "maximumCloudCover": MAX_CLOUD_COVER,
            "zoom": ZOOM,
            "pixelSize": 512,
            "minimumWebpBytes": MIN_PUBLIC_WEBP_BYTES,
            "offsetPolicy": "three nearest globally unique non-uniform tiles",
        },
        "fixtures": fixtures,
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_city_asset_ids(fixtures)
    write_migration(fixtures)
    removed = remove_stale_webp(
        {fixture["assetId"] for fixture in fixtures}
    )
    total_bytes = sum(fixture["bytes"] for fixture in fixtures)
    print(f"Wrote {len(fixtures)} fixtures ({total_bytes / 1024 / 1024:.2f} MiB)")
    print(f"Removed {removed} stale generated WebP files")
    print(f"Manifest: {MANIFEST_PATH}")
    print(f"Migration: {MIGRATION_PATH}")


if __name__ == "__main__":
    main()
