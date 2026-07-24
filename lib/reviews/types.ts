export const answerLintFeatures = [
  "playground_audit",
  "aeo_geo_scoring",
  "business_aware_scan",
  "competitor_comparison",
  "cli",
  "ci_integration",
  "reports",
] as const;

export type AnswerLintFeature = (typeof answerLintFeatures)[number];

export type ReviewStatus =
  | "pending"
  | "needs_revision"
  | "approved"
  | "rejected"
  | "archived";

export type SafetyCategory =
  | "safe"
  | "abusive"
  | "spam"
  | "personal_data"
  | "suspicious_links";

export type QualityCategory =
  | "constructive"
  | "critical"
  | "vague"
  | "off_topic";

export type Review = {
  id: string;
  locale: string;
  rating: 1 | 2 | 3 | 4 | 5;
  experience: string;
  publishedQuote?: string;
  featuresTried: AnswerLintFeature[];
  author: {
    fullName: string;
    showFirstNameOnly: boolean;
    role?: string;
    company?: string;
    email?: string;
    isVerifiedUser: boolean;
  };
  privateImprovementFeedback?: string;
  publishingConsent: boolean;
  featured: boolean;
  displayOrder?: number;
  status: ReviewStatus;
  moderation: {
    automated: {
      safetyCategory: SafetyCategory;
      qualityCategory: QualityCategory;
      confidence: number;
      reasons: string[];
    };
    humanDecision?: {
      status: ReviewStatus;
      editorNote?: string;
      reviewedBy?: string;
      reviewedAt: string;
    };
    checkedAt?: string;
  };
  createdAt: string;
  publishedAt?: string;
};

export type PublicReview = {
  id: string;
  locale: string;
  rating: Review["rating"];
  quote: string;
  featuresTried: AnswerLintFeature[];
  author: {
    displayName: string;
    role?: string;
    company?: string;
    isVerifiedUser: boolean;
  };
  featured: boolean;
  publishedAt: string;
};

export type ReviewSubmission = {
  locale: string;
  rating: Review["rating"];
  experience: string;
  featuresTried: AnswerLintFeature[];
  author: {
    fullName: string;
    showFirstNameOnly: boolean;
    role?: string;
    company?: string;
    email?: string;
  };
  privateImprovementFeedback?: string;
  publishingConsent: boolean;
  website?: string;
};

export const featureLabels: Record<AnswerLintFeature, string> = {
  playground_audit: "Playground audit",
  aeo_geo_scoring: "AEO/GEO scoring",
  business_aware_scan: "Business-aware scan",
  competitor_comparison: "Competitor comparison",
  cli: "CLI",
  ci_integration: "CI integration",
  reports: "Reports",
};
