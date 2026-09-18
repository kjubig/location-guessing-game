import json
import sys
import unittest
from pathlib import Path


SOURCE_ROOT = Path(__file__).parents[1] / "src"
REPOSITORY_ROOT = Path(__file__).parents[3]
PUBLIC_CLUE_DIRECTORY = REPOSITORY_ROOT / "apps" / "web" / "public" / "clues" / "metro"
sys.path.insert(0, str(SOURCE_ROOT))

from golukituki_geodata.build_m2_metro import (  # noqa: E402
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    City,
    build_public_clue,
    validate_public_clue,
)


class MetroPipelineTest(unittest.TestCase):
    def setUp(self) -> None:
        self.city = City("test-city", 37.5, 127.0)
        self.source = {
            "elements": [
                {
                    "type": "node",
                    "id": 1,
                    "lat": 37.5,
                    "lon": 127.0,
                    "tags": {"railway": "station", "name": "Secret Station"},
                },
                {"type": "node", "id": 2, "lat": 37.51, "lon": 127.01},
                {"type": "node", "id": 3, "lat": 37.52, "lon": 127.02},
                {
                    "type": "way",
                    "id": 100,
                    "nodes": [1, 2, 3],
                    "tags": {"railway": "subway", "name": "Secret Line"},
                },
            ]
        }

    def test_transforms_real_geometry_to_anonymous_drawing_coordinates(self) -> None:
        clue, private = build_public_clue(self.source, self.city)
        validate_public_clue(clue)

        self.assertEqual(clue["stations"], [[CANVAS_WIDTH // 2, CANVAS_HEIGHT // 2]])
        self.assertEqual(private["answerLocation"], {"latitude": 37.5, "longitude": 127.0})
        public_json = json.dumps(clue)
        self.assertNotIn("Secret", public_json)
        self.assertNotIn("37.5", public_json)
        self.assertNotIn("127.0", public_json)

    def test_rejects_a_public_clue_with_geographic_keys(self) -> None:
        clue, _ = build_public_clue(self.source, self.city)
        clue["latitude"] = 37.5

        with self.assertRaises(ValueError):
            validate_public_clue(clue)

    def test_committed_metro_clues_are_anonymous_and_valid(self) -> None:
        paths = sorted(PUBLIC_CLUE_DIRECTORY.glob("*.json"))
        self.assertEqual(len(paths), 5)

        for path in paths:
            clue = json.loads(path.read_text(encoding="utf-8"))
            validate_public_clue(clue)
            serialized = json.dumps(clue).lower()
            for forbidden in ("seoul", "busan", "incheon", "daegu", "daejeon"):
                self.assertNotIn(forbidden, serialized)


if __name__ == "__main__":
    unittest.main()
