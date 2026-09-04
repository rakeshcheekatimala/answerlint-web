from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CitationInput(StrictModel):
    url: HttpUrl
    source_type: Literal["owned", "earned", "competitor", "unverified"]
    resolved: bool
    verification_status: Literal["unresolved", "citation_resolved", "claim_supported"]
    excerpt: str | None = Field(default=None, max_length=2000)


class EvidenceRunInput(StrictModel):
    run_id: str = Field(min_length=3, max_length=120)
    prompt_id: str = Field(min_length=3, max_length=120)
    prompt: str = Field(min_length=3, max_length=1000)
    buyer_job: str = Field(min_length=2, max_length=240)
    market: str = Field(min_length=2, max_length=10)
    answer_excerpt: str = Field(min_length=1, max_length=4000)
    brand_mentioned: bool
    recommendation_strength: Literal["none", "mentioned", "recommended", "ranked"]
    citations: list[CitationInput] = Field(default_factory=list, max_length=12)


class OwnedPageInput(StrictModel):
    url: HttpUrl
    reason: str = Field(min_length=2, max_length=500)
    page_role: Literal["revenue", "trust", "support", "comparison", "unknown"] = "unknown"


class AnalysisRequest(StrictModel):
    analysis_id: str = Field(min_length=8, max_length=120)
    project_id: str = Field(min_length=8, max_length=120)
    cohort_version: int = Field(default=1, ge=1, le=10_000)
    brand_name: str = Field(min_length=2, max_length=120)
    brand_url: HttpUrl
    category: str = Field(min_length=2, max_length=200)
    target_customers: str = Field(min_length=2, max_length=500)
    intended_brand_voice: str = Field(default="", max_length=2000)
    approved_claims: list[str] = Field(default_factory=list, max_length=30)
    buyer_jobs: list[str] = Field(min_length=1, max_length=12)
    owned_pages: list[OwnedPageInput] = Field(default_factory=list, max_length=20)
    runs: list[EvidenceRunInput] = Field(min_length=1, max_length=60)

    @model_validator(mode="after")
    def require_unique_run_ids(self) -> "AnalysisRequest":
        ids = [run.run_id for run in self.runs]
        if len(ids) != len(set(ids)):
            raise ValueError("run_id values must be unique")
        return self


class PromptFinding(StrictModel):
    prompt_id: str = Field(min_length=3, max_length=120)
    buyer_job: str = Field(min_length=2, max_length=240)
    finding: str = Field(min_length=5, max_length=1000)
    stakes: Literal["critical", "high", "medium", "low"]
    evidence_run_ids: list[str] = Field(min_length=1, max_length=20)
    source_urls: list[HttpUrl] = Field(default_factory=list, max_length=12)
    uncertainty: str | None = Field(default=None, max_length=500)


class CustomerPainTheme(StrictModel):
    pain: str = Field(min_length=5, max_length=600)
    evidence_type: Literal["observed", "inferred"]
    implication: str = Field(min_length=5, max_length=800)
    affected_prompt_ids: list[str] = Field(min_length=1, max_length=20)
    evidence_run_ids: list[str] = Field(min_length=1, max_length=20)


class BrandVoiceFinding(StrictModel):
    dimension: Literal["accuracy", "completeness", "differentiation", "trust", "risk"]
    observed: str = Field(min_length=5, max_length=1000)
    intended: str = Field(min_length=1, max_length=1000)
    status: Literal["aligned", "partial", "misaligned", "insufficient_evidence"]
    evidence_run_ids: list[str] = Field(default_factory=list, max_length=20)


class ExecutiveDecision(StrictModel):
    audience: Literal["ceo", "cfo", "product", "marketing"]
    decision: str = Field(min_length=5, max_length=600)
    value_case: str = Field(min_length=5, max_length=800)
    risk_if_ignored: str = Field(min_length=5, max_length=800)
    evidence_run_ids: list[str] = Field(min_length=1, max_length=20)
    source_urls: list[HttpUrl] = Field(default_factory=list, max_length=12)
    confidence: Literal["high", "medium", "insufficient"]


class RecommendedAction(StrictModel):
    title: str = Field(min_length=5, max_length=240)
    why_now: str = Field(min_length=5, max_length=1200)
    owner: Literal["seo", "content", "pr", "web", "product_marketing"]
    effort: Literal["low", "medium", "high"]
    stakes: Literal["critical", "high", "medium", "low"]
    business_outcome: Literal[
        "demand_capture", "conversion", "retention", "trust", "risk_reduction"
    ]
    decision_makers: list[Literal["ceo", "cfo", "product", "marketing"]] = Field(
        min_length=1, max_length=4
    )
    value_hypothesis: str = Field(min_length=5, max_length=1000)
    cost_of_inaction: str = Field(min_length=5, max_length=1000)
    impact_horizon: Literal["now", "this_quarter", "strategic"]
    evidence_thesis: str = Field(min_length=5, max_length=1200)
    alternatives_considered: list[str] = Field(min_length=1, max_length=5)
    do_not_do: list[str] = Field(min_length=1, max_length=5)
    falsification_rule: str = Field(min_length=5, max_length=1000)
    linked_page_url: HttpUrl
    acceptance_criteria: list[str] = Field(min_length=1, max_length=8)
    retest_rule: str = Field(min_length=5, max_length=1000)
    affected_prompt_ids: list[str] = Field(min_length=1, max_length=20)
    evidence_run_ids: list[str] = Field(min_length=1, max_length=20)
    source_urls: list[HttpUrl] = Field(default_factory=list, max_length=12)
    confidence: Literal["high", "medium", "insufficient"]


class AnalysisResponse(StrictModel):
    analysis_id: str
    project_id: str
    status: Literal["completed", "insufficient_evidence"]
    model_runtime: str
    prompt_version: str
    executive_headline: str = Field(min_length=5, max_length=240)
    executive_summary: str = Field(min_length=5, max_length=1600)
    primary_risk: str | None = Field(default=None, max_length=1000)
    findings: list[PromptFinding] = Field(default_factory=list, max_length=20)
    customer_pain_themes: list[CustomerPainTheme] = Field(default_factory=list, max_length=10)
    brand_voice: list[BrandVoiceFinding] = Field(default_factory=list, max_length=10)
    executive_decisions: list[ExecutiveDecision] = Field(default_factory=list, max_length=4)
    actions: list[RecommendedAction] = Field(default_factory=list, max_length=10)
    limitations: list[str] = Field(default_factory=list, max_length=12)
