import pytest

from answerlint_visibility_crew.security import (
    AuthenticationError,
    ReplayGuard,
    create_signature,
    verify_signature,
)


SECRET = "s" * 32
BODY = b'{"project_id":"project-1"}'
REQUEST_ID = "analysis-123"


def test_accepts_current_valid_signature() -> None:
    timestamp = "1000"
    verify_signature(
        secret=SECRET,
        timestamp=timestamp,
        request_id=REQUEST_ID,
        signature=create_signature(SECRET, timestamp, REQUEST_ID, BODY),
        body=BODY,
        ttl_seconds=300,
        now=1100,
    )


@pytest.mark.parametrize(
    ("timestamp", "signature"),
    [(None, None), ("not-a-number", "v1=nope"), ("1000", "v1=nope")],
)
def test_rejects_invalid_signatures(timestamp: str | None, signature: str | None) -> None:
    with pytest.raises(AuthenticationError):
        verify_signature(
            secret=SECRET,
            timestamp=timestamp,
            request_id=REQUEST_ID,
            signature=signature,
            body=BODY,
            ttl_seconds=300,
            now=1100,
        )


def test_rejects_expired_signature() -> None:
    timestamp = "1000"
    with pytest.raises(AuthenticationError, match="expired"):
        verify_signature(
            secret=SECRET,
            timestamp=timestamp,
            request_id=REQUEST_ID,
            signature=create_signature(SECRET, timestamp, REQUEST_ID, BODY),
            body=BODY,
            ttl_seconds=30,
            now=1100,
        )


def test_replay_guard_rejects_a_reused_request_id() -> None:
    guard = ReplayGuard()
    guard.claim(REQUEST_ID, expires_at=1300, now=1000)

    with pytest.raises(AuthenticationError, match="already processed"):
        guard.claim(REQUEST_ID, expires_at=1300, now=1001)
