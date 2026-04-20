from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.core.config import settings


@dataclass(frozen=True)
class LocationSearchResult:
    display_name: str
    street: str
    house_number: str
    postcode: str
    city: str
    state: str
    country: str
    lat: str
    lon: str
    source: str
    source_id: str


def _pick_city(address: dict[str, Any]) -> str:
    for key in ("city", "town", "village", "municipality", "hamlet"):
        value = address.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def search_locations(query: str, *, limit: int = 5) -> list[LocationSearchResult]:
    normalized = query.strip()
    if len(normalized) < 3:
        return []

    params = urlencode(
        {
            "q": normalized,
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": max(1, min(limit, 5)),
        }
    )
    request = Request(
        f"{settings.location_search_url}?{params}",
        headers={
            "Accept": "application/json",
            "User-Agent": settings.location_user_agent,
        },
    )

    try:
        with urlopen(request, timeout=settings.location_search_timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return []

    results: list[LocationSearchResult] = []
    for row in payload if isinstance(payload, list) else []:
        address = row.get("address") if isinstance(row, dict) else {}
        if not isinstance(address, dict):
            address = {}
        source_id = f"{row.get('osm_type', '')}:{row.get('osm_id', '')}" if isinstance(row, dict) else ""
        results.append(
            LocationSearchResult(
                display_name=str(row.get("display_name", "")).strip(),
                street=str(address.get("road", "")).strip(),
                house_number=str(address.get("house_number", "")).strip(),
                postcode=str(address.get("postcode", "")).strip(),
                city=_pick_city(address),
                state=str(address.get("state", "")).strip(),
                country=str(address.get("country", "")).strip(),
                lat=str(row.get("lat", "")).strip(),
                lon=str(row.get("lon", "")).strip(),
                source="nominatim",
                source_id=source_id.strip(":"),
            )
        )
    return results
