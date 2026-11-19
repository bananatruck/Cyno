"""Tests for build-catalog.py. Run: python3 -I scripts/test_build_catalog.py (from packages/engine)."""
import importlib.util
import tempfile
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
        original_fetch = build.fetch
        build.fetch = lambda url: b"name    |app_mag|app_mag_flag\nNGC 2168|    5.1|null\n"
        try:
            self.assertEqual(build.ngc2000_vmag("NGC2168", 92.2711, 24.3386), 5.1)
        finally:
            build.fetch = original_fetch


class LocalPinnedSources(unittest.TestCase):
    def setUp(self):
        self.pinned_digests = build.PINNED_SHA256.copy()
        self.fetch = build.fetch

    def tearDown(self):
        self.assertEqual(build.PINNED_SHA256, self.pinned_digests)
        self.assertIs(build.fetch, self.fetch)

    def test_local_digest_verified_file_is_used(self):
        body = b"# pinned fixture\n"
        digest = build.sha256(body)
        name = "IAU-CSN"
        original_digest = build.PINNED_SHA256[name]
        original_fetch = build.fetch
        build.PINNED_SHA256[name] = digest
        try:
            with tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp) / build.PINNED_LOCAL_FILES[name]
                path.write_bytes(body)
                called = []

                def fail_fetch(url: str) -> bytes:
                    called.append(url)
                    raise AssertionError("fetch should not run when a verified local file exists")

                build.fetch = fail_fetch
                text = build.fetch_pinned(name, build.IAU_URL, Path(tmp))
                self.assertEqual(text, body.decode("utf-8"))
                self.assertEqual(called, [])
        finally:
            build.fetch = original_fetch
            build.PINNED_SHA256[name] = original_digest

    def test_local_file_with_wrong_digest_exits(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / build.PINNED_LOCAL_FILES["IAU-CSN"]
            path.write_bytes(b"wrong bytes")
            with self.assertRaises(SystemExit) as ctx:
                build.fetch_pinned("IAU-CSN", build.IAU_URL, Path(tmp))
            self.assertNotEqual(ctx.exception.code, 0)


if __name__ == "__main__":
    unittest.main()
