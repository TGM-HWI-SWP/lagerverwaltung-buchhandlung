from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def sign_token(payload: dict, *, secret: str, ttl_seconds: int) -> str:
    now = int(time.time())
    body = {
        **payload,
        "iat": now,
        "exp": now + ttl_seconds,
    }
    raw = json.dumps(body, separators=(",", ":"), sort_keys=True).encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).digest()
    return f"{_b64url(raw)}.{_b64url(sig)}"


def verify_token(token: str, *, secret: str) -> dict | None:
    try:
        raw_b64, sig_b64 = token.split(".", 1)
    except ValueError:
        return None

    try:
        raw = _b64url_decode(raw_b64)
        sig = _b64url_decode(sig_b64)
    except Exception:
        return None

    expected = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected):
        return None

    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        return None

    exp = payload.get("exp")
    if not isinstance(exp, int) or exp < int(time.time()):
        return None

    return payload
