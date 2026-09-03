import { evidenceConfidence } from "@/lib/visibility/evidence";
import type {
  AnswerObservation,
  CitationEvidence,
  EvidenceConfidence,
  VisibilityAction,
  VisibilityProject,
  VisibilitySurface,
} from "@/lib/visibility/types";

export type VisibilityMetric = {
  label: string;
  value: number | null;
  reason: string;
};

export type CollectedVisibilityRun = {
  runId: string;
  promptId: string;
  topicId: string;
  surface: VisibilitySurface;
  market: string;
  language: string;
  modelRuntime?: string;
  runAt?: string;
  parserVersion?: string;
  answerExcerpt?: string | null;
  rawAnswerArtifactPath?: string | null;
  sourceManifestArtifactPath?: string | null;
  observation: AnswerObservation;
  citations: CitationEvidence[];
};

export type VisibilityEvidence = { runs: CollectedVisibilityRun[] };

export type EvidenceGroup = {
  promptId: string;
  topicId: string;
  surface: VisibilitySurface;
  runs: CollectedVisibilityRun[];
  confidence: EvidenceConfidence;
  brandMentionRate: number;
  recommendationRate: number;
  competitorMentionRate: number;
  citations: CitationEvidence[];
};

export type VisibilityWorkspaceReport = {
  state: "planning" | "awaiting_evidence" | "measuring" | "completed";
  executiveBrief: string;
  metrics: VisibilityMetric[];
  topicRows: Array<{
    topic: string;
    intent: string;
    evidence: string;
    nextAction: string;
  }>;
  sourceMapMessage: string;
  narrativeMessage: string;
  competitorMessage: string;
  actionQueueMessage: string;
  actions: VisibilityAction[];
  measurementCoverage: {
    plannedRuns: number;
    completedRuns: number;
    percentage: number | null;
  };
  evidenceRows: Array<{
    runId: string;
    prompt: string;
    topic: string;
    surface: VisibilitySurface;
    market: string;
    runAt: string;
    modelRuntime: string;
    answerExcerpt: string | null;
    brandMentioned: boolean;
    recommendationStrength: AnswerObservation["recommendationStrength"];
    rankedPosition: number | null;
    confidence: EvidenceConfidence;
    citations: CitationEvidence[];
  }>;
  sourceRows: Array<{
    url: string;
    domain: string;
    sourceType: CitationEvidence["sourceType"];
    citationCount: number;
    resolvedCount: number;
    supportingCount: number;
  }>;
};

/**
 * Turns individual manifests into repeat-tested groups. It deliberately keeps
 * a group insufficient unless every run has an observed answer, a citation,
 * a resolvable source, and a source/entity relationship.
 */
export function aggregateEvidence(
  project: VisibilityProject,
  evidence: VisibilityEvidence,
): EvidenceGroup[] {
  const grouped = new Map<string, CollectedVisibilityRun[]>();
  for (const run of evidence.runs) {
    const key = `${run.promptId}:${run.surface}`;
    grouped.set(key, [...(grouped.get(key) ?? []), run]);
  }

  return [...grouped.values()].map((runs) => {
    const first = runs[0];
    const citations = runs.flatMap((run) => run.citations);
    const confidence = evidenceConfidence({
      answerObserved: runs.every((run) => run.observation.answerObserved),
      citationExtracted: runs.every((run) => run.citations.some((citation) => citation.canonicalUrl)),
      sourceResolved: runs.every((run) =>
        run.citations.some((citation) => citation.resolved && citation.canonicalUrl),
      ),
      claimVerified: runs.every((run) =>
        run.citations.some((citation) => citation.resolved && citation.supportsClaim),
      ),
      completedRepeatCount: runs.length,
      requiredRepeatCount: project.intake.runtimePolicy.repeatRuns,
    });

    return {
      promptId: first.promptId,
      topicId: first.topicId,
      surface: first.surface,
      runs,
      confidence,
      brandMentionRate: rate(runs.filter((run) => run.observation.brandMentioned).length, runs.length),
      recommendationRate: rate(
        runs.filter((run) => ["recommended", "ranked"].includes(run.observation.recommendationStrength)).length,
        runs.length,
      ),
      competitorMentionRate: rate(
        runs.filter((run) => run.observation.competitorMentions.length > 0).length,
        runs.length,
      ),
      citations,
    };
  });
}

/**
 * A report never fills an unobserved metric with a guessed zero. Zero and no
 * evidence have different commercial meanings, so planning projects render an
 * explicit evidence state instead.
 */
export function buildVisibilityWorkspaceReport(
  project: VisibilityProject,
  evidence?: VisibilityEvidence,
): VisibilityWorkspaceReport {
  const measuredEvidence = evidence ?? { runs: [] };
  const groups = aggregateEvidence(project, measuredEvidence);
  if (!groups.length) return unmeasuredReport(project);

  const verifiedGroups = groups.filter((group) => group.confidence !== "insufficient");
  const qualifiedWeight = verifiedGroups.reduce((sum, group) => {
    const prompt = project.prompts.find((item) => item.id === group.promptId);
    return sum + (prompt?.importanceScore ?? 0);
  }, 0);
  const visibleWeight = verifiedGroups
    .filter((group) => group.brandMentionRate > 0)
    .reduce((sum, group) => sum + (project.prompts.find((item) => item.id === group.promptId)?.importanceScore ?? 0), 0);
  const resolvedCitations = groups.flatMap((group) => group.citations).filter((citation) => citation.resolved);
  const ownedCitations = resolvedCitations.filter((citation) => citation.sourceType === "owned");
  const actions = buildActionQueue(project, verifiedGroups);
  const verifiedExcerpts = verifiedGroups.reduce((count, group) => count + group.runs.length, 0);
  const plannedRuns = plannedRunCount(project);
  const evidenceRows = toEvidenceRows(project, measuredEvidence.runs);
  const sourceRows = toSourceRows(measuredEvidence.runs.flatMap((run) => run.citations));

  return {
    state: project.state === "completed" ? "completed" : "measuring",
    executiveBrief:
      verifiedGroups.length > 0
        ? `${verifiedGroups.length} prompt–surface groups have repeat-tested evidence. Metrics below exclude incomplete or unstable groups.`
        : "Runs exist, but none meet the answer, citation, resolved-source, claim, and repeat verification gate yet.",
    metrics: [
      metric("Qualified Answer Visibility", percentage(visibleWeight, qualifiedWeight), "Weighted by approved prompt importance; only repeat-tested groups count."),
      metric("Recommendation rate", average(verifiedGroups.map((group) => group.recommendationRate)), "Only explicit parser-detected recommendations or genuine ranked lists count."),
      metric("Owned citation rate", percentage(ownedCitations.length, resolvedCitations.length), "Resolved citations on the submitted brand domain divided by all resolved citations."),
      metric("Competitive answer win rate", competitiveWinRate(verifiedGroups), "Shared prompts only; no average rank is inferred where the answer has no ranked list."),
      metric("Narrative fidelity", null, "Requires a reviewed narrative parser over verified excerpts; it is not inferred from sentiment."),
    ],
    topicRows: project.topics.filter((topic) => topic.included).map((topic) => {
      const topicGroups = groups.filter((group) => group.topicId === topic.id);
      const verified = topicGroups.filter((group) => group.confidence !== "insufficient");
      const brandPresence = average(verified.map((group) => group.brandMentionRate));
      return {
        topic: topic.statement,
        intent: `${topic.buyerIntent} · ${topic.commercialValue} value`,
        evidence: verified.length
          ? `${formatPercent(brandPresence)} verified brand presence across ${verified.length} prompt–surface group${verified.length === 1 ? "" : "s"}.`
          : "Signal detected, not yet strong enough to recommend action.",
        nextAction:
          actions.find((action) => action.affectedPromptIds.some((id) => topicGroups.some((group) => group.promptId === id)))?.action ??
          "Collect repeated answer and citation evidence first.",
      };
    }),
    sourceMapMessage: sourceMapMessage(resolvedCitations),
    narrativeMessage:
      verifiedExcerpts > 0
        ? `${verifiedExcerpts} verified answer excerpts are available. Narrative fidelity remains pending a reviewed parser instead of a sentiment guess.`
        : "Observed positioning is unavailable until verified answer excerpts are collected across selected surfaces.",
    competitorMessage: competitorMessage(verifiedGroups),
    actionQueueMessage:
      actions.length > 0
        ? `${actions.length} verified action${actions.length === 1 ? "" : "s"} are ready for the appropriate owner.`
        : "Signal detected, not yet strong enough to recommend action. The Action Queue opens only when the answer, citation, resolved source, claim relationship, and repeat threshold all pass.",
    actions,
    measurementCoverage: {
      plannedRuns,
      completedRuns: measuredEvidence.runs.length,
      percentage: percentage(measuredEvidence.runs.length, plannedRuns),
    },
    evidenceRows,
    sourceRows,
  };
}

export function buildActionQueue(
  project: VisibilityProject,
  groups: EvidenceGroup[],
): VisibilityAction[] {
  return groups.flatMap<VisibilityAction>((group): VisibilityAction[] => {
    const prompt = project.prompts.find((item) => item.id === group.promptId);
    const topic = project.topics.find((item) => item.id === group.topicId);
    if (!prompt || !topic || group.confidence === "insufficient") return [];
    const competitorSources = group.citations.filter((citation) => citation.sourceType === "competitor" && citation.resolved);
    const ownedSources = group.citations.filter((citation) => citation.sourceType === "owned" && citation.resolved);
    const common = {
      affectedPromptIds: [prompt.id],
      markets: [prompt.market],
      surfaces: [group.surface],
      confidence: group.confidence,
      status: "actionable" as const,
    };

    if (group.brandMentionRate === 0 && competitorSources.length > 0) {
      return [{
        id: `comparison-${group.promptId}-${group.surface}`,
        action: `Create a comparison page for ${project.intake.brandName} and the confirmed alternatives in “${topic.statement}”.`,
        whyNow: `The brand was absent across ${group.runs.length} verified runs while ${competitorSources.length} resolved competitor source${competitorSources.length === 1 ? " was" : "s were"} cited.`,
        expectedImpact: "recommendation" as const,
        owner: "content" as const,
        effort: "medium" as const,
        dependency: "Confirm legal and product-marketing comparison claims.",
        verificationRule: `Improve verified brand presence for “${prompt.text}” across ${project.intake.runtimePolicy.repeatRuns} fresh runs.`,
        ...common,
      }];
    }

    if (group.brandMentionRate > 0 && ownedSources.length === 0) {
      return [{
        id: `owned-citation-${group.promptId}-${group.surface}`,
        action: `Strengthen an owned page for “${topic.statement}” with a directly answerable claim and supporting proof.`,
        whyNow: `The brand appeared in ${formatPercent(group.brandMentionRate)} of verified runs, but none of the ${group.citations.filter((citation) => citation.resolved).length} resolved citations pointed to an owned source.`,
        expectedImpact: "citation" as const,
        owner: "seo" as const,
        effort: "medium" as const,
        dependency: null,
        verificationRule: `Increase the resolved owned-citation rate for “${prompt.text}” without reducing repeat-tested presence.`,
        ...common,
      }];
    }

    return [];
  });
}

function unmeasuredReport(project: VisibilityProject): VisibilityWorkspaceReport {
  const measurementState =
    project.state === "benchmarking" || project.state === "benchmark_queued"
      ? "measuring"
      : project.state === "ready_to_benchmark"
        ? "awaiting_evidence"
        : "planning";
  const evidenceReason = "Not measured yet — no verified answer runs are available.";
  return {
    state: measurementState,
    executiveBrief: "No answer-visibility claim is shown until official surface runs and source verification are complete.",
    metrics: [
      "Qualified Answer Visibility",
      "Recommendation rate",
      "Owned citation rate",
      "Competitive answer win rate",
      "Narrative fidelity",
    ].map((label) => metric(label, null, evidenceReason)),
    topicRows: project.topics.filter((topic) => topic.included).map((topic) => ({
      topic: topic.statement,
      intent: `${topic.buyerIntent} · ${topic.commercialValue} value`,
      evidence: "Not run",
      nextAction: "Collect repeated answer and citation evidence first.",
    })),
    sourceMapMessage: "No sources are classified yet. Verified owned, earned, competitor, and unstable sources appear here only after citations resolve.",
    narrativeMessage: "Observed positioning is unavailable until verified answer excerpts are collected across selected surfaces.",
    competitorMessage: "Head-to-head comparison requires shared high-intent prompts with verified observations for each entity.",
    actionQueueMessage: "Signal detected, not yet strong enough to recommend action. The Action Queue opens only when the answer, citation, resolved source, claim relationship, and repeat threshold all pass.",
    actions: [],
    measurementCoverage: {
      plannedRuns: plannedRunCount(project),
      completedRuns: 0,
      percentage: null,
    },
    evidenceRows: [],
    sourceRows: [],
  };
}

function plannedRunCount(project: VisibilityProject) {
  const includedTopics = new Set(
    project.topics.filter((topic) => topic.included).map((topic) => topic.id),
  );
  return project.prompts
    .filter((prompt) => includedTopics.has(prompt.topicId))
    .reduce((count, prompt) => count + prompt.surfaces.length * prompt.plannedSamples, 0);
}

function toEvidenceRows(project: VisibilityProject, runs: CollectedVisibilityRun[]) {
  return [...runs]
    .sort((left, right) => (right.runAt ?? "").localeCompare(left.runAt ?? ""))
    .map((run) => ({
      runId: run.runId,
      prompt: project.prompts.find((prompt) => prompt.id === run.promptId)?.text ?? "Unknown prompt",
      topic: project.topics.find((topic) => topic.id === run.topicId)?.statement ?? "Unknown topic",
      surface: run.surface,
      market: run.market,
      runAt: run.runAt ?? "",
      modelRuntime: run.modelRuntime ?? "Recorded provider",
      answerExcerpt: run.answerExcerpt ?? null,
      brandMentioned: run.observation.brandMentioned,
      recommendationStrength: run.observation.recommendationStrength,
      rankedPosition: run.observation.rankedPosition,
      confidence: run.observation.confidence,
      citations: run.citations,
    }));
}

function toSourceRows(citations: CitationEvidence[]) {
  const grouped = new Map<string, {
    url: string;
    domain: string;
    sourceType: CitationEvidence["sourceType"];
    citationCount: number;
    resolvedCount: number;
    supportingCount: number;
  }>();
  for (const citation of citations) {
    const key = citation.canonicalUrl ?? citation.url;
    const existing = grouped.get(key);
    const domain = sourceDomain(key);
    grouped.set(key, {
      url: key,
      domain,
      sourceType: citation.sourceType,
      citationCount: (existing?.citationCount ?? 0) + 1,
      resolvedCount: (existing?.resolvedCount ?? 0) + Number(citation.resolved),
      supportingCount: (existing?.supportingCount ?? 0) + Number(citation.supportsClaim),
    });
  }
  return [...grouped.values()].sort((left, right) => right.citationCount - left.citationCount);
}

function sourceDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "Unresolved URL";
  }
}

function metric(label: string, value: number | null, reason: string): VisibilityMetric {
  return { label, value, reason };
}

function rate(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function percentage(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : null;
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function competitiveWinRate(groups: EvidenceGroup[]) {
  const shared = groups.filter((group) => group.competitorMentionRate > 0 || group.brandMentionRate > 0);
  return shared.length
    ? Math.round((shared.filter((group) => group.brandMentionRate > group.competitorMentionRate).length / shared.length) * 100)
    : null;
}

function sourceMapMessage(citations: CitationEvidence[]) {
  if (!citations.length) return "No citation source resolved yet; unverified sources remain excluded from reporting.";
  const count = (type: CitationEvidence["sourceType"]) => citations.filter((citation) => citation.sourceType === type).length;
  return `${count("owned")} owned, ${count("earned")} earned, and ${count("competitor")} competitor resolved citation${citations.length === 1 ? "" : "s"} are mapped by prompt, surface, and market.`;
}

function competitorMessage(groups: EvidenceGroup[]) {
  const shared = groups.filter((group) => group.competitorMentionRate > 0 && group.brandMentionRate > 0);
  if (!shared.length) return "Head-to-head comparison requires shared high-intent prompts with verified observations for each entity.";
  return `${shared.length} shared prompt–surface group${shared.length === 1 ? "" : "s"} have verified brand and competitor observations. Use the linked source evidence before assigning a winner.`;
}
