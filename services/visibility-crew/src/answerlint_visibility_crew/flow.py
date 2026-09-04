from __future__ import annotations

from pydantic import BaseModel, Field

from crewai.flow.flow import Flow, listen, start

from .crew import AnswerEvidenceCrew, PROMPT_VERSION
from .guardrails import validate_evidence_references
from .schemas import AnalysisRequest, AnalysisResponse
from .settings import Settings


class VisibilityFlowState(BaseModel):
    request_payload: dict = Field(default_factory=dict)
    response_payload: dict = Field(default_factory=dict)


class VisibilityAnalysisFlow(Flow[VisibilityFlowState]):
    """Typed CrewAI Flow with deterministic validation before and after agency."""

    def __init__(self, *, request: AnalysisRequest, settings: Settings) -> None:
        super().__init__()
        self._request = request
        self._settings = settings

    @start()
    def validate_signed_evidence(self) -> dict:
        self.state.request_payload = self._request.model_dump(mode="json")
        return self.state.request_payload

    @listen(validate_signed_evidence)
    def interpret_with_crew(self) -> dict:
        evidence_json = self._request.model_dump_json(indent=2)
        output = AnswerEvidenceCrew(self._settings).crew().kickoff(
            inputs={
                "analysis_id": self._request.analysis_id,
                "project_id": self._request.project_id,
                "brand_name": self._request.brand_name,
                "evidence_json": evidence_json,
            }
        )
        if output.pydantic is None:
            raise ValueError("CrewAI did not return the required structured analysis")
        analysis = AnalysisResponse.model_validate(output.pydantic)
        analysis = analysis.model_copy(
            update={
                "analysis_id": self._request.analysis_id,
                "project_id": self._request.project_id,
                "model_runtime": self._settings.llm_model,
                "prompt_version": PROMPT_VERSION,
            }
        )
        validated = validate_evidence_references(analysis, self._request)
        self.state.response_payload = validated.model_dump(mode="json")
        return self.state.response_payload


def run_analysis(request: AnalysisRequest, settings: Settings) -> AnalysisResponse:
    flow = VisibilityAnalysisFlow(request=request, settings=settings)
    flow.kickoff(inputs={"id": request.analysis_id})
    if not flow.state.response_payload:
        raise RuntimeError("CrewAI flow completed without an analysis")
    return AnalysisResponse.model_validate(flow.state.response_payload)
