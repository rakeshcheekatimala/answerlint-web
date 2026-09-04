import pytest

from answerlint_visibility_crew.guardrails import validate_evidence_references
from answerlint_visibility_crew.schemas import AnalysisRequest, AnalysisResponse


def request_payload() -> AnalysisRequest:
    return AnalysisRequest.model_validate(
        {
            "analysis_id": "analysis-123",
            "project_id": "project-123",
            "brand_name": "Example",
            "brand_url": "https://example.com",
            "category": "Travel connectivity",
            "target_customers": "Travellers",
            "intended_brand_voice": "Reliable travel connectivity",
            "approved_claims": [],
            "buyer_jobs": ["Choose an eSIM"],
            "owned_pages": [
                {
                    "url": "https://example.com/esim",
                    "reason": "Primary revenue page",
                    "page_role": "revenue",
                }
            ],
            "runs": [
                {
                    "run_id": "run-123",
                    "prompt_id": "prompt-123",
                    "prompt": "What is the best eSIM?",
                    "buyer_job": "Choose an eSIM",
                    "market": "SG",
                    "answer_excerpt": "Example is mentioned.",
                    "brand_mentioned": True,
                    "recommendation_strength": "mentioned",
                    "citations": [
                        {
                            "url": "https://publisher.example/esim",
                            "source_type": "earned",
                            "resolved": True,
                            "verification_status": "citation_resolved",
                        }
                    ],
                }
            ],
        }
    )


def response_payload(**action_updates: object) -> AnalysisResponse:
    action = {
        "title": "Improve the eSIM evidence page",
        "why_now": "The supplied answer uses an independent source.",
        "owner": "content",
        "effort": "medium",
        "stakes": "high",
        "business_outcome": "conversion",
        "decision_makers": ["ceo", "product"],
        "value_hypothesis": "Clearer evidence may reduce uncertainty in the buyer decision.",
        "cost_of_inaction": "The observed citation gap remains unaddressed.",
        "impact_horizon": "this_quarter",
        "evidence_thesis": "A direct proof block may make the approved claim easier to retrieve.",
        "alternatives_considered": ["The answer may vary because the cohort is small."],
        "do_not_do": ["Do not publish unsupported comparison claims."],
        "falsification_rule": "Reject the thesis if the locked cohort shows no citation change.",
        "linked_page_url": "https://example.com/esim",
        "acceptance_criteria": ["Answer the buyer question directly"],
        "retest_rule": "Rerun prompt-123 with the locked cohort.",
        "affected_prompt_ids": ["prompt-123"],
        "evidence_run_ids": ["run-123"],
        "source_urls": ["https://publisher.example/esim"],
        "confidence": "medium",
        **action_updates,
    }
    return AnalysisResponse.model_validate(
        {
            "analysis_id": "analysis-123",
            "project_id": "project-123",
            "status": "completed",
            "model_runtime": "test/model",
            "prompt_version": "test/1",
            "executive_headline": "Example is visible but lacks owned evidence",
            "executive_summary": "The supplied answer mentions Example.",
            "findings": [],
            "brand_voice": [],
            "actions": [action],
            "limitations": [],
        }
    )


def test_accepts_references_present_in_signed_input() -> None:
    request = request_payload()
    response = response_payload()
    assert validate_evidence_references(response, request) == response


def test_rejects_invented_evidence_reference() -> None:
    with pytest.raises(ValueError, match="Unknown action run"):
        validate_evidence_references(
            response_payload(evidence_run_ids=["invented-run"]),
            request_payload(),
        )


def test_rejects_invented_owned_page() -> None:
    with pytest.raises(ValueError, match="Unknown owned-page"):
        validate_evidence_references(
            response_payload(linked_page_url="https://attacker.example/page"),
            request_payload(),
        )
