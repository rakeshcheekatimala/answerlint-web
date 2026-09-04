import json
from typing import Any, Tuple

from crewai import TaskOutput
from pydantic import ValidationError

from .schemas import AnalysisRequest, AnalysisResponse


DISALLOWED_CAUSAL_PHRASES = (
    "this caused",
    "will cause",
    "guaranteed to",
    "guarantees",
    "proves that the change",
)


def structured_analysis_guardrail(result: TaskOutput) -> Tuple[bool, Any]:
    """CrewAI task guardrail: require the public response schema and safe language."""
    try:
        candidate = result.pydantic or json.loads(result.raw)
        analysis = (
            candidate
            if isinstance(candidate, AnalysisResponse)
            else AnalysisResponse.model_validate(candidate)
        )
    except (json.JSONDecodeError, ValidationError, TypeError, ValueError):
        return False, "Return only a valid AnalysisResponse JSON object."

    rendered = analysis.model_dump_json().lower()
    phrase = next((item for item in DISALLOWED_CAUSAL_PHRASES if item in rendered), None)
    if phrase:
        return False, f"Remove unsupported causal language: {phrase}"
    return True, analysis


def validate_evidence_references(
    analysis: AnalysisResponse,
    request: AnalysisRequest,
) -> AnalysisResponse:
    """Fail closed when an agent references evidence it never received."""
    run_ids = {run.run_id for run in request.runs}
    prompt_ids = {run.prompt_id for run in request.runs}
    source_urls = {str(citation.url) for run in request.runs for citation in run.citations}
    owned_urls = {str(page.url) for page in request.owned_pages}

    for finding in analysis.findings:
        _require_subset("finding run", finding.evidence_run_ids, run_ids)
        _require_subset("finding source", map(str, finding.source_urls), source_urls)
        if finding.prompt_id not in prompt_ids:
            raise ValueError(f"Unknown finding prompt reference: {finding.prompt_id}")

    for pain in analysis.customer_pain_themes:
        _require_subset("customer pain run", pain.evidence_run_ids, run_ids)
        _require_subset("customer pain prompt", pain.affected_prompt_ids, prompt_ids)

    for voice in analysis.brand_voice:
        _require_subset("brand voice run", voice.evidence_run_ids, run_ids)

    for decision in analysis.executive_decisions:
        _require_subset("executive decision run", decision.evidence_run_ids, run_ids)
        _require_subset("executive decision source", map(str, decision.source_urls), source_urls)

    for action in analysis.actions:
        _require_subset("action run", action.evidence_run_ids, run_ids)
        _require_subset("action prompt", action.affected_prompt_ids, prompt_ids)
        _require_subset("action source", map(str, action.source_urls), source_urls)
        if str(action.linked_page_url) not in owned_urls:
            raise ValueError(f"Unknown owned-page reference: {action.linked_page_url}")

    if analysis.project_id != request.project_id or analysis.analysis_id != request.analysis_id:
        raise ValueError("Analysis identity does not match the signed request")
    return analysis


def _require_subset(label: str, values: Any, allowed: set[str]) -> None:
    unknown = set(values) - allowed
    if unknown:
        raise ValueError(f"Unknown {label} reference(s): {', '.join(sorted(unknown))}")
