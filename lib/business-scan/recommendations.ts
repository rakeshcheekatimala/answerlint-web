import type { AuditResult } from "@/lib/siteops/types";
import {
  type BusinessPageAudit,
  type BusinessScanPage,
  type FixFirstRecommendation,
  type PageScoreContribution,
} from "@/lib/business-scan/types";

const ISSUE_LABELS: Record<string, string> = {
  faq_schema: "Add FAQ structure",
  direct_answer: "Improve answer structure",
  qa_density: "Add question-led sections",
  readability: "Simplify page copy",
  named_entities: "Strengthen entity coverage",
  author_byline: "Add authorship signals",
  topical_depth: "Improve heading coverage",
  trust_signals: "Add trust signals",
  content_freshness: "Show freshness clearly",
  external_links: "Add authoritative citations",
  comparison_content: "Add comparison context",
  citation_likelihood: "Improve citation readiness",
};

const EFFORT_BY_AUDIT: Record<string, FixFirstRecommendation["effort"]> = {
  faq_schema: "Medium",
  direct_answer: "Low",
  qa_density: "Low",
  readability: "Low",
  named_entities: "Low",
  author_byline: "Medium",
  topical_depth: "Medium",
  trust_signals: "Medium",
  content_freshness: "Low",
  external_links: "Low",
  comparison_content: "Medium",
  citation_likelihood: "High",
};

const RECOVERABLE_FRACTION_BY_AUDIT: Record<string, number> = {
  direct_answer: 0.35,
  faq_schema: 0.28,
  trust_signals: 0.26,
  topical_depth: 0.24,
  citation_likelihood: 0.22,
  qa_density: 0.2,
  content_freshness: 0.18,
  external_links: 0.16,
  author_byline: 0.16,
  readability: 0.14,
  named_entities: 0.12,
  comparison_content: 0.12,
};

export function buildFixFirstRecommendations({
  audits,
  pageContributions,
}: {
  audits: BusinessPageAudit[];
  pageContributions: PageScoreContribution[];
}): FixFirstRecommendation[] {
  const contributionByPageId = new Map(
    pageContributions.map((contribution) => [
      contribution.pageId,
      contribution,
    ]),
  );

  return audits
    .flatMap(({ page, report }) => {
      const contribution = contributionByPageId.get(page.id);
      if (!contribution || contribution.recoverableProjectPoints <= 0) return [];

      const failingAudits = report.audits.filter((audit) => audit.status !== "pass");
      // Partition the page's recoverable points across its failing audits so the
      // per-audit gains SUM to the page's recoverable pool (fixing everything
      // takes the page to 100). Previously each audit took an independent
      // fraction of the same pool, which double-counted and overstated gains.
      const fractionSum = failingAudits.reduce(
        (sum, audit) => sum + fractionForAudit(audit.id),
        0,
      );
      if (fractionSum <= 0) return [];

      return failingAudits.map((audit) =>
        recommendationFromAudit(page, audit, contribution, fractionSum),
      );
    })
    .filter((recommendation): recommendation is FixFirstRecommendation =>
      Boolean(recommendation),
    )
    .sort((left, right) => rankRecommendation(right) - rankRecommendation(left))
    .slice(0, 8);
}

function fractionForAudit(auditId: string) {
  return RECOVERABLE_FRACTION_BY_AUDIT[auditId] ?? 0.1;
}

function recommendationFromAudit(
  page: BusinessScanPage,
  audit: AuditResult,
  contribution: PageScoreContribution,
  pageFractionSum: number,
): FixFirstRecommendation | null {
  const normalizedShare = fractionForAudit(audit.id) / pageFractionSum;
  const expectedScoreGain = roundImpact(
    contribution.recoverableProjectPoints * normalizedShare,
  );

  if (expectedScoreGain <= 0) return null;

  const issue = ISSUE_LABELS[audit.id] ?? audit.title;
  const effort = EFFORT_BY_AUDIT[audit.id] ?? "Medium";

  return {
    id: `${page.id}_${audit.id}`,
    pageId: page.id,
    pageName: page.title,
    pageUrl: page.url,
    issue,
    impact: expectedScoreGain,
    effort,
    expectedScoreGain,
    suggestedAction:
      audit.recommendation?.instruction ??
      `Improve ${audit.title.toLowerCase()} to recover visibility points.`,
    why: `${page.title} is a ${page.impactTier} impact ${formatCategoryForWhy(page.category)} page.`,
  };
}

function rankRecommendation(recommendation: FixFirstRecommendation) {
  const effortScore =
    recommendation.effort === "Low"
      ? 2
      : recommendation.effort === "Medium"
        ? 1
        : 0;

  return recommendation.expectedScoreGain * 10 + effortScore;
}

function roundImpact(value: number) {
  return Math.round(value * 10) / 10;
}

function formatCategoryForWhy(category: string) {
  return category.replace(" Pages", "").toLowerCase();
}
