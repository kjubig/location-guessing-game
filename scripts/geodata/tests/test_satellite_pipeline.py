import hashlib
import json
import sys
import unittest
from pathlib import Path


SOURCE_ROOT = Path(__file__).parents[1] / "src"
sys.path.insert(0, str(SOURCE_ROOT))

from golukituki_geodata.build_m4_satellite import (  # noqa: E402
    City,
    MIN_PUBLIC_WEBP_BYTES,
    SourceItem,
    TileSpec,
    asset_id,
    item_covers_tiles,
    tile_specs,
    validate_public_webp,
)

REPOSITORY_ROOT = Path(__file__).parents[3]
MANIFEST_PATH = REPOSITORY_ROOT / "data" / "source" / "m4-satellite-fixtures.json"
CLUE_DIRECTORY = REPOSITORY_ROOT / "apps" / "web" / "public" / "clues"
CITIES_PATH = REPOSITORY_ROOT / "data" / "cities.json"


def webp_with_chunks(*chunks: tuple[bytes, bytes]) -> bytes:
    body = b""
    for name, payload in chunks:
        body += name + len(payload).to_bytes(4, "little") + payload
        if len(payload) % 2:
            body += b"\0"
    return b"RIFF" + (len(body) + 4).to_bytes(4, "little") + b"WEBP" + body


class SatellitePipelineTest(unittest.TestCase):
    def test_catalog_has_30_unique_sourced_cities(self) -> None:
        catalog = json.loads(CITIES_PATH.read_text(encoding="utf-8"))
        cities = catalog["cities"]

        self.assertEqual(len(cities), 30)
        self.assertEqual(len({city["id"] for city in cities}), 30)
        self.assertEqual(len({city["source"]["recordId"] for city in cities}), 30)
        self.assertTrue(
            all(city["source"]["provider"] == "GeoNames" for city in cities)
        )
        self.assertTrue(all(len(city["clueAssetIds"]) == 3 for city in cities))
        self.assertEqual(
            len(
                {
                    asset_id
                    for city in cities
                    for asset_id in city["clueAssetIds"]
                }
            ),
            90,
        )

    def test_committed_pool_has_three_verified_assets_per_city(self) -> None:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        fixtures = manifest["fixtures"]
        counts: dict[str, int] = {}

        self.assertEqual(len(fixtures), 90)
        self.assertEqual(len({item["publicPath"] for item in fixtures}), 90)
        self.assertEqual(
            len(
                {
                    (item["tile"]["zoom"], item["tile"]["x"], item["tile"]["y"])
                    for item in fixtures
                }
            ),
            90,
        )
        for fixture in fixtures:
            counts[fixture["cityId"]] = counts.get(fixture["cityId"], 0) + 1
            filename = Path(fixture["publicPath"]).name
            self.assertRegex(filename, r"^[0-9a-f]{20}\.webp$")
            self.assertNotIn(fixture["cityId"], filename)
            payload = (CLUE_DIRECTORY / filename).read_bytes()
            validate_public_webp(payload)
            self.assertEqual(len(payload), fixture["bytes"])
            self.assertGreaterEqual(len(payload), MIN_PUBLIC_WEBP_BYTES)
            self.assertEqual(hashlib.sha256(payload).hexdigest(), fixture["sha256"])

        self.assertEqual(set(counts.values()), {3})
        self.assertEqual(len(counts), 30)

    def test_static_clues_fit_the_release_asset_budget(self) -> None:
        files = [path for path in CLUE_DIRECTORY.rglob("*") if path.is_file()]
        webp_files = list(CLUE_DIRECTORY.glob("*.webp"))

        self.assertLessEqual(len(files), 20_000)
        self.assertTrue(all(path.stat().st_size < 25 * 1024 * 1024 for path in files))
        self.assertTrue(all(path.stat().st_size < 1024 * 1024 for path in webp_files))
        self.assertLessEqual(
            sum(path.stat().st_size for path in webp_files), 10 * 1024 * 1024
        )

    def test_generates_three_unique_offset_tiles_per_city(self) -> None:
        city = City("seoul", 37.566, 126.9784)
        source = SourceItem("2025-01-01T00:00:00Z", 1.0, "S2-test")
        tiles = tile_specs(city)

        self.assertEqual(len(tiles), 3)
        self.assertEqual(len({(tile.x, tile.y) for tile in tiles}), 3)
        self.assertEqual(len({asset_id(source, tile) for tile in tiles}), 3)

    def test_accepts_metadata_free_webp(self) -> None:
        validate_public_webp(webp_with_chunks((b"VP8 ", b"image-data")))

    def test_rejects_an_item_that_does_not_cover_every_offset(self) -> None:
        tiles = [TileSpec(3516, 1621, 12), TileSpec(3517, 1621, 12)]

        self.assertFalse(item_covers_tiles([128.9, 34.9, 129.05, 35.3], tiles))
        self.assertTrue(item_covers_tiles([128.9, 34.9, 129.2, 35.3], tiles))

    def test_rejects_exif_and_xmp_metadata(self) -> None:
        with self.assertRaisesRegex(ValueError, "EXIF"):
            validate_public_webp(webp_with_chunks((b"EXIF", b"coordinates")))
        with self.assertRaisesRegex(ValueError, "XMP"):
            validate_public_webp(webp_with_chunks((b"XMP ", b"coordinates")))


if __name__ == "__main__":
    unittest.main()
