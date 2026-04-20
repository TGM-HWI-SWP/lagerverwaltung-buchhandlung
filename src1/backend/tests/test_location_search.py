import json
import sys
import unittest
from unittest.mock import patch
from pathlib import Path
from types import ModuleType

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

if "pydantic_settings" not in sys.modules:
    stub = ModuleType("pydantic_settings")

    class BaseSettings:
        def __init__(self, **kwargs):
            annotations = getattr(self.__class__, "__annotations__", {})
            for key in annotations:
                if hasattr(self.__class__, key):
                    setattr(self, key, getattr(self.__class__, key))
            for key, value in kwargs.items():
                setattr(self, key, value)

    stub.BaseSettings = BaseSettings
    sys.modules["pydantic_settings"] = stub

from app.core.location_search import search_locations


class _DummyResponse:
    def __init__(self, payload: list[dict]):
        self._payload = payload

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class LocationSearchTest(unittest.TestCase):
    def test_search_locations_normalizes_nominatim_rows(self) -> None:
        payload = [
            {
                "display_name": "Mariahilfer Straße 100, 1060 Wien, Österreich",
                "lat": "48.196151",
                "lon": "16.339681",
                "osm_type": "way",
                "osm_id": 123,
                "address": {
                    "road": "Mariahilfer Straße",
                    "house_number": "100",
                    "postcode": "1060",
                    "city": "Wien",
                    "state": "Wien",
                    "country": "Österreich",
                },
            }
        ]

        with patch("app.core.location_search.urlopen", return_value=_DummyResponse(payload)):
            results = search_locations("Mariahilfer Straße 100 Wien")

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].display_name, payload[0]["display_name"])
        self.assertEqual(results[0].city, "Wien")
        self.assertEqual(results[0].source, "nominatim")
        self.assertEqual(results[0].source_id, "way:123")

    def test_search_locations_returns_empty_on_short_query_or_api_error(self) -> None:
        self.assertEqual(search_locations("ab"), [])

        with patch("app.core.location_search.urlopen", side_effect=RuntimeError("boom")):
            self.assertEqual(search_locations("Wien"), [])


if __name__ == "__main__":
    unittest.main()
