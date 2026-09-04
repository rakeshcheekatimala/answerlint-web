import type { VisibilityIntake } from "@/lib/visibility/schema";

export const VISIBILITY_SURFACES = [
  "chatgpt_search",
  "perplexity",
  "google_ai_overview",
  "claude",
] as const;

export type VisibilitySurface = (typeof VISIBILITY_SURFACES)[number];

/** The closed beta exposes one evidence-capable surface, deliberately. */
export const SUPPORTED_VISIBILITY_SURFACES = ["chatgpt_search"] as const satisfies readonly VisibilitySurface[];

/**
 * A score only makes sense in the context of how it was collected. These lanes
 * are intentionally never merged into a single visibility percentage.
 */
export const MEASUREMENT_LANES = [
  "native_observed",
  "controlled_run",
  "site_readiness",
  "hypothesis",
] as const;

export type MeasurementLane = (typeof MEASUREMENT_LANES)[number];

export type VisibilitySurfaceDefinition = {
  surface: VisibilitySurface;
  label: string;
  shortLabel: string;
  measurementLane: Extract<MeasurementLane, "native_observed" | "controlled_run">;
  availability: "available" | "coming_soon";
  description: string;
};

/** Client-safe product metadata. Runtime configuration is checked server-side. */
export const VISIBILITY_SURFACE_DEFINITIONS: VisibilitySurfaceDefinition[] = [
  {
    surface: "chatgpt_search",
    label: "OpenAI web search",
    shortLabel: "OpenAI Search",
    measurementLane: "controlled_run",
    availability: "available",
    description: "A repeatable, recorded API run. It is not presented as a consumer-product rank.",
  },
];

export const REVENUE_GOALS = [
  "awareness",
  "pipeline",
  "ecommerce_conversion",
  "retention",
  "local_discovery",
] as const;

export type RevenueGoal = (typeof REVENUE_GOALS)[number];

export const BUYER_INTENTS = [
  "discover",
  "compare",
  "evaluate",
  "purchase",
  "troubleshoot",
] as const;

export type BuyerIntent = (typeof BUYER_INTENTS)[number];

export type EvidenceConfidence = "high" | "medium" | "insufficient";

export type ProjectState =
  | "awaiting_brand_approval"
  | "awaiting_topic_approval"
  | "ready_to_benchmark"
  | "benchmark_queued"
  | "benchmarking"
  | "completed"
  | "failed";

export type RuntimePolicy = {
  searchMode: "search_enabled" | "model_only";
  freshSession: boolean;
  device: "desktop" | "mobile";
  repeatRuns: number;
  testFrequency: "one_time" | "weekly" | "monthly";
};

export type EntityBaselineHealth = {
  crawl: "pending" | "healthy" | "needs_review";
  index: "pending" | "healthy" | "needs_review";
  canonical: "pending" | "healthy" | "needs_review";
  schema: "pending" | "healthy" | "needs_review";
  access: "pending" | "healthy" | "needs_review";
};

export type BrandIntelligenceCard = {
  canonicalName: string;
  aliases: string[];
  valueProposition: string;
  idealCustomerProfile: string;
  products: string[];
  locations: string[];
  people: string[];
  claims: string[];
  pricingSignals: string[];
  existingNarrative: string;
  ambiguityRisks: string[];
  initialOwnedAssets: Array<{
    url: string;
    reason: string;
    verificationStatus: "pending" | "verified" | "unverified";
  }>;
  health: EntityBaselineHealth;
  approvalStatus: "pending" | "approved";
  approvedAt: string | null;
};

export type TopicMapItem = {
  id: string;
  statement: string;
  buyerIntent: BuyerIntent;
  funnelStage: "awareness" | "consideration" | "decision" | "retention";
  commercialValue: "high" | "medium" | "low";
  market: string;
  language: string;
  narrativeRelevance: string;
  competitorNames: string[];
  evidenceSufficiency: "unknown" | "limited" | "sufficient";
  evidenceGap: string;
  promptCount: number;
  surfaces: VisibilitySurface[];
  included: boolean;
};

export type PromptKind =
  | "category_discovery"
  | "use_case_evaluation"
  | "comparison"
  | "proof_and_trust"
  | "local_regional"
  | "brand_narrative"
  | "negative_risk"
  | "owned_citation";

export type PromptPlan = {
  id: string;
  topicId: string;
  text: string;
  kind: PromptKind;
  buyerRealism: "buyer_realistic" | "brand_controlled" | "diagnostic";
  market: string;
  language: string;
  surfaces: VisibilitySurface[];
  whySelected: string;
  importanceScore: number;
  competitorEntities: string[];
  plannedSamples: number;
  included: boolean;
  status: "planned" | "queued" | "running" | "complete" | "failed";
};

export type VisibilityBenchmarkProgress = {
  plannedRuns: number;
  completedRuns: number;
  failedRuns: number;
  currentStage: "idle" | "queued" | "collecting" | "verifying" | "interpreting" | "complete" | "failed";
  currentPromptId: string | null;
  message: string;
  updatedAt: string;
};

export type CitationEvidence = {
  url: string;
  canonicalUrl: string | null;
  title: string | null;
  excerpt: string | null;
  sourceType: "owned" | "earned" | "competitor" | "unverified";
  resolved: boolean;
  /** A URL can resolve before its readable text establishes the required claim. */
  verificationStatus?: "unresolved" | "citation_resolved" | "claim_supported";
  supportsClaim: boolean;
};

export type RunManifest = {
  id: string;
  promptId: string;
  surface: VisibilitySurface;
  modelRuntime: string;
  searchMode: RuntimePolicy["searchMode"];
  market: string;
  language: string;
  device: RuntimePolicy["device"];
  sessionPolicy: "fresh" | "reused";
  runAt: string;
  repetition: number;
  rawAnswerArtifactPath: string | null;
  sourceManifestArtifactPath: string | null;
  parserVersion: string;
  parserStatus: "pending" | "parsed" | "failed";
  status: "queued" | "running" | "complete" | "partial" | "failed";
};

export type AnswerObservation = {
  runId: string;
  answerObserved: boolean;
  brandMentioned: boolean;
  competitorMentions: string[];
  recommendationStrength: "none" | "mentioned" | "recommended" | "ranked";
  rankedPosition: number | null;
  citations: CitationEvidence[];
  confidence: EvidenceConfidence;
  claimVerified: boolean;
  signal: string;
};

export type VisibilityAction = {
  id: string;
  action: string;
  whyNow: string;
  expectedImpact: "mention" | "recommendation" | "citation" | "narrative_correction";
  owner: "seo" | "content" | "pr" | "web" | "product_marketing";
  effort: "low" | "medium" | "high";
  dependency: string | null;
  affectedPromptIds: string[];
  markets: string[];
  surfaces: VisibilitySurface[];
  confidence: EvidenceConfidence;
  verificationRule: string;
  status: "signal_only" | "actionable" | "completed";
};

export type VisibilityProject = {
  id: string;
  ownerMode: "anonymous" | "account";
  state: ProjectState;
  intake: VisibilityIntake;
  brandCard: BrandIntelligenceCard;
  topics: TopicMapItem[];
  prompts: PromptPlan[];
  actions: VisibilityAction[];
  benchmarkProgress?: VisibilityBenchmarkProgress;
  createdAt: string;
  updatedAt: string;
  storageStatus: "stored" | "skipped" | "failed";
  storageError?: string;
  editToken?: string;
};

export type VisibilityProjectResponse = {
  project: VisibilityProject;
};
