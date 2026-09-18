import sys
import unittest
from pathlib import Path


SOURCE_ROOT = Path(__file__).parents[1] / "src"
sys.path.insert(0, str(SOURCE_ROOT))

from golukituki_geodata import PROJECT_NAME  # noqa: E402


class WorkspaceTest(unittest.TestCase):
    def test_project_identity(self) -> None:
        self.assertEqual(PROJECT_NAME, "GEOLUKITUKI")


if __name__ == "__main__":
    unittest.main()
