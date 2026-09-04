export type CrewPromptFinding = {
  promptId: string;
  buyerJob: string;
  finding: string;
  stakes: "critical" | "high" | "medium" | "low";
  evidenceRunIds: string[];
  sourceUrls: string[];
  uncertainty: string | null;
};

export type CrewCustomerPainTheme = {
  pain: string;
  evidenceType: "observed" | "inferred";
  implication: string;
  affectedPromptIds: string[];
  evidenceRunIds: string[];
};

export type CrewBrandVoiceFinding = {
  dimension: "accuracy" | "completeness" | "differentiation" | "trust" | "risk";
  observed: string;
  intended: string;
  status: "aligned" | "partial" | "misaligned" | "insufficient_evidence";
  evidenceRunIds: string[];
};

export type CrewExecutiveDecision = {
  audience: "ceo" | "cfo" | "product" | "marketing";
  decision: string;
  valueCase: string;
  riskIfIgnored: string;
  evidenceRunIds: string[];
  sourceUrls: string[];
  confidence: "high" | "medium" | "insufficient";
};

export type CrewRecommendedAction = {
  title: string;
  whyNow: string;
  owner: "seo" | "content" | "pr" | "web" | "product_marketing";
  effort: "low" | "medium" | "high";
  stakes: "critical" | "high" | "medium" | "low";
  businessOutcome: "demand_capture" | "conversion" | "retention" | "trust" | "risk_reduction";
  decisionMakers: Array<"ceo" | "cfo" | "product" | "marketing">;
  valueHypothesis: string;
  costOfInaction: string;
  impactHorizon: "now" | "this_quarter" | "strategic";
  evidenceThesis: string;
  alternativesConsidered: string[];
  doNotDo: string[];
  falsificationRule: string;
  linkedPageUrl: string;
  acceptanceCriteria: string[];
  retestRule: string;
  affectedPromptIds: string[];
  evidenceRunIds: string[];
  sourceUrls: string[];
  confidence: "high" | "medium" | "insufficient";
};

export type VisibilityCrewAnalysis = {
  analysisId: string;
  projectId: string;
  status: "completed" | "insufficient_evidence";
  modelRuntime: string;
  promptVersion: string;
  executiveHeadline: string;
  executiveSummary: string;
  primaryRisk: string | null;
  findings: CrewPromptFinding[];
  customerPainThemes: CrewCustomerPainTheme[];
  brandVoice: CrewBrandVoiceFinding[];
  executiveDecisions: CrewExecutiveDecision[];
  actions: CrewRecommendedAction[];
  limitations: string[];
  createdAt?: string;
};
