from __future__ import annotations

import hashlib
import hmac
import time
from collections import OrderedDict
from threading import Lock


class AuthenticationError(ValueError):
    pass


def signing_message(timestamp: str, request_id: str, body: bytes) -> bytes:
    return timestamp.encode("ascii") + b"." + request_id.encode("ascii") + b"." + body


def create_signature(secret: str, timestamp: str, request_id: str, body: bytes) -> str:
    digest = hmac.new(
        secret.encode("utf-8"),
        signing_message(timestamp, request_id, body),
        hashlib.sha256,
    ).hexdigest()
    return f"v1={digest}"


def verify_signature(
    *,
    secret: str,
    timestamp: str | None,
    request_id: str | None,
    signature: str | None,
    body: bytes,
    ttl_seconds: int,
    now: int | None = None,
) -> None:
    if not timestamp or not request_id or not signature:
        raise AuthenticationError("Missing request signature")
    if len(request_id) < 8 or len(request_id) > 120 or not request_id.isascii():
        raise AuthenticationError("Invalid request id")
    try:
        issued_at = int(timestamp)
    except ValueError as error:
        raise AuthenticationError("Invalid request timestamp") from error

    current_time = int(time.time()) if now is None else now
    if abs(current_time - issued_at) > ttl_seconds:
        raise AuthenticationError("Request signature expired")

    expected = create_signature(secret, timestamp, request_id, body)
    if not hmac.compare_digest(expected, signature):
        raise AuthenticationError("Invalid request signature")


class ReplayGuard:
    """Bounded per-instance replay protection layered over the signed TTL."""

    def __init__(self, max_entries: int = 10_000) -> None:
        self._max_entries = max_entries
        self._seen: OrderedDict[str, int] = OrderedDict()
        self._lock = Lock()

    def claim(self, request_id: str, expires_at: int, now: int | None = None) -> None:
        current = int(time.time()) if now is None else now
        with self._lock:
            while self._seen and next(iter(self._seen.values())) < current:
                self._seen.popitem(last=False)
            if request_id in self._seen:
                raise AuthenticationError("Request already processed")
            self._seen[request_id] = expires_at
            while len(self._seen) > self._max_entries:
                self._seen.popitem(last=False)
