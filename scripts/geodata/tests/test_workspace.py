import sys
import unittest
from pathlib import Path


SOURCE_ROOT = Path(__file__).parents[1] / "src"
sys.path.insert(0, str(SOURCE_ROOT))

from golukituki_geodata import PROJECT_NAME  # noqa: E402
from golukituki_geodata.fetch_m1_fixtures import (  # noqa: E402
    tile_center,
    web_mercator_tile,
)


class WorkspaceTest(unittest.TestCase):
    def test_project_identity(self) -> None:
        self.assertEqual(PROJECT_NAME, "GEOLUKITUKI")

    def test_web_mercator_tile_center_contains_source_point(self) -> None:
        latitude = 37.5665
        longitude = 126.978
        x, y = web_mercator_tile(longitude, latitude, 12)
        center_latitude, center_longitude = tile_center(x, y, 12)

        self.assertLess(abs(center_latitude - latitude), 0.05)
        self.assertLess(abs(center_longitude - longitude), 0.05)


if __name__ == "__main__":
    unittest.main()
