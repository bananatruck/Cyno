"""Tests for build-catalog.py. Run: python3 -I scripts/test_build_catalog.py (from packages/engine)."""
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("build_catalog", Path(__file__).with_name("build-catalog.py"))
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class Ngc2000Fallback(unittest.TestCase):
    def check(self, body: bytes) -> None:
        original = build.fetch
        build.fetch = lambda url: body
        try:
            with self.assertRaises(SystemExit) as ctx:
                build.ngc2000_vmag("NGC2168", 92.2711, 24.3386)
            self.assertNotEqual(ctx.exception.code, 0)
        finally:
            build.fetch = original

    def test_empty_response_is_an_error(self):
        self.check(b"")

    def test_plain_text_error_is_an_error(self):
        self.check(b"Service unavailable, try again later\n")

    def test_expected_row_returns_the_magnitude(self):
        build.fetch = lambda url: b"name    |app_mag|app_mag_flag\nNGC 2168|    5.1|null\n"
        self.assertEqual(build.ngc2000_vmag("NGC2168", 92.2711, 24.3386), 5.1)


if __name__ == "__main__":
    unittest.main()
