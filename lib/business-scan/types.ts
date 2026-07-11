import type { SiteOpsReport } from "@/lib/siteops/types";

export const BUSINESS_SCAN_URL_LIMIT = 250;

export const BUSINESS_CATEGORIES = [
  "Revenue Pages",
  "Trust Pages",
  "Developer Pages",
  "Support Pages",
  "Content Pages",
  "Low Priority / Legal",
  "Uncategorized",
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

export const IMPACT_TIERS = [
  "Very High",
  "High",
  "Medium",
  "Low",
  "Ignored",
] as const;

export type BusinessImpactTier = (typeof IMPACT_TIERS)[number];

export const CATEGORY_WEIGHTS: Record<BusinessCategory, number> = {
  "Revenue Pages": 40,
  "Trust Pages": 25,
  "Developer Pages": 20,
  "Support Pages": 10,
  "Content Pages": 5,
  "Low Priority / Legal": 0,
  Uncategorized: 0,
};

export const IMPACT_SHARES: Record<BusinessImpactTier, number> = {
  "Very High": 4,
  High: 3,
  Medium: 2,
  Low: 1,
  Ignored: 0,
};

export type BusinessScanPageSource =
  | "sitemap"
  | "robots"
  | "internal_link"
  | "canonical"
  | "navigation"
  | "base_url";

export type BusinessScanPage = {
  id: string;
  url: string;
  title: string;
  canonicalUrl?: string;
  statusCode?: number;
  category: BusinessCategory;
  impactTier: BusinessImpactTier;
  included: boolean;
  is_manually_categorized: boolean;
  reason: string;
  confidence: number;
  signals: string[];
  source: BusinessScanPageSource;
  incomingInternalLinks: number;
  isNavigationLinked: boolean;
  isHomepageLinked: boolean;
  contentSummary?: string;
  score?: number;
  lastCheckedAt?: string;
};

export type BusinessScanProject = {
  id: string;
  baseUrl: string;
  discoveredUrls: string[];
  pages: BusinessScanPage[];
  businessModel: string;
  scanHistory: BusinessScanRun[];
  latestScore: number | null;
  potentialScore: number | null;
  lostOpportunityScore: number | null;
  createdAt: string;
  updatedAt: string;
  storageStatus: "stored" | "skipped" | "failed";
  storageError?: string;
  /**
   * Per-project edit token, returned to the creator once (on discovery/scan).
   * Required to read or mutate a stored project. Never persisted in this field
   * and never returned by reads — only its hash lives in the database.
   */
  editToken?: string;
};

export type CategoryScoreBreakdown = {
  category: BusinessCategory;
  baseWeight: number;
  activeWeight: number;
  score: number;
  includedPages: number;
  totalShares: number;
  redistributed: boolean;
};

export type PageScoreContribution = {
  pageId: string;
  category: BusinessCategory;
  pageScore: number;
  projectWeight: number;
  projectPoints: number;
  recoverableProjectPoints: number;
};

export type BusinessScoreResult = {
  currentScore: number;
  scoringMix: CategoryScoreBreakdown[];
  pageContributions: PageScoreContribution[];
  excludedCategoryMessages: string[];
};

export type FixFirstRecommendation = {
  id: string;
  pageId: string;
  pageName: string;
  pageUrl: string;
  issue: string;
  impact: number;
  effort: "Low" | "Medium" | "High";
  expectedScoreGain: number;
  suggestedAction: string;
  why: string;
};

export type BusinessScanRun = {
  id: string;
  scannedAt: string;
  currentScore: number;
  potentialScore: number;
  lostOpportunityScore: number;
  categoryScores: CategoryScoreBreakdown[];
  pageScores: PageScoreContribution[];
  recommendations: FixFirstRecommendation[];
  auditedPages: number;
};

export type BusinessScanDashboard = {
  run: BusinessScanRun;
  project: BusinessScanProject;
};

export type BusinessPageAudit = {
  page: BusinessScanPage;
  report: SiteOpsReport;
};

export type DiscoveryProgressEvent =
  | {
      type: "status";
      message: string;
      pageCount: number;
      groups: Array<{ category: BusinessCategory; count: number }>;
    }
  | {
      type: "fallback";
      message: string;
      pageCount: number;
    }
  | {
      type: "project";
      project: BusinessScanProject;
    }
  | {
      type: "error";
      error: string;
    };
