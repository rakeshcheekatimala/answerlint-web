import type {
  PlaygroundAuditResponse,
  PlaygroundComparisonResponse,
  SiteOpsComparisonReport,
  SiteOpsDownloads,
  SiteOpsReport,
} from "@/lib/siteops/types";
import type { ReportAccessConfig } from "@/lib/reports/access";

export type AuditReportKind = "single" | "comparison";

export type UnlockStatus = "locked" | "unlocked";

export type SingleReportPreview = {
  kind: "single";
  targetUrl: string;
  createdAt: string;
  scores: SiteOpsReport["scores"];
  issueCount: number;
  passCount: number;
  topIssues: Array<{
    id: string;
    title: string;
    status: string;
    evidence: string;
    priority?: string;
    scoreImpact?: number;
  }>;
};

export type ComparisonReportPreview = {
  kind: "comparison";
  targetUrl: string;
  competitorUrl: string;
  createdAt: string;
  targetScores: SiteOpsReport["scores"];
  competitorScores: SiteOpsReport["scores"];
  leader: SiteOpsComparisonReport["comparison"]["leader"];
  improveFirst: SiteOpsComparisonReport["comparison"]["improve_first"];
  competitorEdges: SiteOpsComparisonReport["comparison"]["competitor_edges"];
};

export type AuditReportPreview = SingleReportPreview | ComparisonReportPreview;

export type GatedReportResponse = {
  reportId: string;
  claimToken: string;
  preview: AuditReportPreview;
  access: ReportAccessConfig;
  storageStatus: "stored" | "skipped" | "failed";
  storageError?: string;
  report:
    | PlaygroundAuditResponse["report"]
    | PlaygroundComparisonResponse["report"];
  downloads: SiteOpsDownloads;
};

export type UnlockedReportResponse = {
  id: string;
  kind: AuditReportKind;
  email: string | null;
  targetUrl: string;
  competitorUrl: string | null;
  createdAt: string;
  unlockedAt: string | null;
  report:
    | PlaygroundAuditResponse["report"]
    | PlaygroundComparisonResponse["report"];
  downloads: SiteOpsDownloads;
};
