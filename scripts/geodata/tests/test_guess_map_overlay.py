import json
import sys
import unittest
from pathlib import Path


SOURCE_ROOT = Path(__file__).parents[1] / "src"
sys.path.insert(0, str(SOURCE_ROOT))

from golukituki_geodata.build_guess_map_overlay import (  # noqa: E402
    OUTPUT_PATH,
    SOURCE_PATH,
    build_svg,
)


class GuessMapOverlayTest(unittest.TestCase):
    def test_checked_in_overlay_is_current_and_has_expected_bounds(self) -> None:
        source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
        svg, bounds = build_svg(source)

        self.assertEqual(
            bounds,
            (124.613617, 33.197577, 131.862522, 38.624335),
        )
        self.assertIn('fill-rule="evenodd"', svg)
        self.assertEqual(OUTPUT_PATH.read_text(encoding="utf-8"), svg)


if __name__ == "__main__":
    unittest.main()
