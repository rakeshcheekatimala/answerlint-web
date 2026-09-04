import json
import time

from fastapi.testclient import TestClient

from answerlint_visibility_crew import api
from answerlint_visibility_crew.schemas import AnalysisResponse
from answerlint_visibility_crew.security import create_signature


def valid_request() -> dict:
    return {
        "analysis_id": "analysis-api-123",
        "project_id": "project-api-123",
        "brand_name": "Example",
        "brand_url": "https://example.com",
        "category": "Travel connectivity",
        "target_customers": "Travellers",
        "buyer_jobs": ["Choose an eSIM"],
        "owned_pages": [{"url": "https://example.com", "reason": "Brand home"}],
        "runs": [{
            "run_id": "run-api-123",
            "prompt_id": "prompt-api-123",
            "prompt": "What is the best eSIM?",
            "buyer_job": "Choose an eSIM",
            "market": "SG",
            "answer_excerpt": "Example is mentioned.",
            "brand_mentioned": True,
            "recommendation_strength": "mentioned",
            "citations": [],
        }],
    }


def test_health_is_public_but_analysis_requires_a_signature() -> None:
    client = TestClient(api.app)
    assert client.get("/health").json()["status"] == "ok"
    assert client.post("/v1/analyze", json=valid_request()).status_code == 401


def test_oversized_request_is_rejected_before_authentication() -> None:
    client = TestClient(api.app)
    response = client.post(
        "/v1/analyze",
        content=b"{}",
        headers={"content-length": str(api.settings.max_body_bytes + 1)},
    )

    assert response.status_code == 413


def test_signed_analysis_is_schema_validated_and_replay_protected(monkeypatch) -> None:
    def fake_run_analysis(request, _settings) -> AnalysisResponse:
        return AnalysisResponse(
            analysis_id=request.analysis_id,
            project_id=request.project_id,
            status="insufficient_evidence",
            model_runtime="test/model",
            prompt_version="test/1",
            executive_headline="More evidence is required",
            executive_summary="The cohort is valid but intentionally inconclusive.",
            limitations=["Mocked local contract test."],
        )

    monkeypatch.setattr(api, "run_analysis", fake_run_analysis)
    client = TestClient(api.app)
    body = json.dumps(valid_request(), separators=(",", ":")).encode()
    timestamp = str(int(time.time()))
    request_id = "analysis-api-123"
    headers = {
        "content-type": "application/json",
        "x-answerlint-key-id": "primary",
        "x-answerlint-timestamp": timestamp,
        "x-answerlint-request-id": request_id,
        "x-answerlint-signature": create_signature(
            "s" * 32, timestamp, request_id, body
        ),
    }

    response = client.post("/v1/analyze", content=body, headers=headers)
    assert response.status_code == 200
    assert response.json()["analysis_id"] == request_id

    replay = client.post("/v1/analyze", content=body, headers=headers)
    assert replay.status_code == 401
