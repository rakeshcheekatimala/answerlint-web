import type {
  SiteOpsComparisonReport,
  SiteOpsReport,
} from "@/lib/siteops/types";
import type {
  ComparisonReportPreview,
  SingleReportPreview,
} from "@/lib/reports/types";

export function createSingleReportPreview(
  report: SiteOpsReport,
): SingleReportPreview {
  const issueAudits = report.audits.filter((audit) => audit.status !== "pass");

  return {
    kind: "single",
    targetUrl: report.url,
    createdAt: report.timestamp,
    scores: report.scores,
    issueCount: issueAudits.length,
    passCount: report.audits.length - issueAudits.length,
    topIssues: issueAudits.slice(0, 3).map((audit) => ({
      id: audit.id,
      title: audit.title,
      status: audit.status,
      evidence: audit.evidence,
      priority: audit.recommendation?.priority,
      scoreImpact: audit.recommendation?.score_impact,
    })),
  };
}

export function createComparisonReportPreview(
  report: SiteOpsComparisonReport,
): ComparisonReportPreview {
  return {
    kind: "comparison",
    targetUrl: report.target.url,
    competitorUrl: report.competitor.url,
    createdAt: report.timestamp,
    targetScores: report.target.scores,
    competitorScores: report.competitor.scores,
    leader: report.comparison.leader,
    improveFirst: report.comparison.improve_first.slice(0, 3),
    competitorEdges: report.comparison.competitor_edges.slice(0, 3),
  };
}
