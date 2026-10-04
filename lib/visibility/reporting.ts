import type {
  AnswerObservation,
  CitationEvidence,
  EvidenceConfidence,
  VisibilityAction,
  VisibilityProject,
  VisibilitySurface,
} from "@/lib/visibility/types";
import type { VisibilityCrewAnalysis } from "@/lib/visibility/crew/types";

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
  runStatus?: "complete" | "partial";
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
  citations: CitationEvidence[];
};

export type LeadershipCitationRow = {
  name: string;
  role: "you" | "competitor" | "independent" | "other";
  citations: number;
  /** Null until at least one citation resolves. Zero and “not measured” stay distinct. */
  share: number | null;
};

export type LeadershipMissingPrompt = {
  promptId: string;
  prompt: string;
  citedInstead: string[];
  runs: number;
};

export type LeadershipTechnicalCheck = {
  id: string;
  label: string;
  status: "pass" | "needs_work" | "partial" | "waiting";
  detail: string;
};

export type LeadershipFix = {
  rank: number;
  title: string;
  why: string;
  evidence: string;
};

export type LeadershipPage = {
  status: "waiting" | "partial" | "ready";
  headline: string;
  method: string;
  citationShare: LeadershipCitationRow[];
  citationNote: string;
  namedInPrompts: string;
  missingPrompts: LeadershipMissingPrompt[];
  missingNote: string;
  technicalChecks: LeadershipTechnicalCheck[];
  fixes: LeadershipFix[];
  fixesNote: string;
};

export type VisibilityWorkspaceReport = {
  state: "planning" | "awaiting_evidence" | "measuring" | "completed";
  executiveBrief: string;
  leadership: LeadershipPage;
  crewAnalysis: VisibilityCrewAnalysis | null;
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
    status: "measured" | "partial";
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
 * Turns individual manifests into repeat-tested groups. Headline mention
 * metrics require a complete answer cohort; citation verification remains a
 * distinct lane and is never smuggled into a synthetic visibility score.
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
    const confidence = repeatConfidence(
      runs.every((run) => run.observation.answerObserved),
      runs.length,
      project.intake.runtimePolicy.repeatRuns,
    );

    return {
      promptId: first.promptId,
      topicId: first.topicId,
      surface: first.surface,
      runs,
      confidence,
      brandMentionRate: rate(
        runs.filter((run) => run.observation.brandMentioned).length,
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
  crewAnalysis: VisibilityCrewAnalysis | null = null,
): VisibilityWorkspaceReport {
  const measuredEvidence = evidence ?? { runs: [] };
  const groups = aggregateEvidence(project, measuredEvidence);
  if (!groups.length) return unmeasuredReport(project);

  const eligibleGroups = groups.filter(
    (group) => group.confidence !== "insufficient",
  );
  const eligibleWeight = eligibleGroups.reduce((sum, group) => {
    const prompt = project.prompts.find((item) => item.id === group.promptId);
    return sum + (prompt?.importanceScore ?? 0);
  }, 0);
  const visibleWeight = eligibleGroups
    .filter((group) => group.brandMentionRate > 0)
    .reduce(
      (sum, group) =>
        sum +
        (project.prompts.find((item) => item.id === group.promptId)
          ?.importanceScore ?? 0),
      0,
    );
  const resolvedCitations = groups
    .flatMap((group) => group.citations)
    .filter((citation) => citation.resolved);
  const ownedCitations = resolvedCitations.filter(
    (citation) => citation.sourceType === "owned",
  );
  const actions = mergeVisibilityActions(
    buildActionQueue(project, eligibleGroups),
    crewAnalysis,
  );
  const completedExcerpts = eligibleGroups.reduce(
    (count, group) => count + group.runs.length,
    0,
  );
  const plannedRuns = plannedRunCount(project);
  const evidenceRows = toEvidenceRows(project, measuredEvidence.runs);
  const sourceRows = toSourceRows(
    measuredEvidence.runs.flatMap((run) => run.citations),
  );

  const leadership = buildLeadershipPage(project, measuredEvidence, groups, actions);

  return {
    state: project.state === "completed" ? "completed" : "measuring",
    executiveBrief:
      crewAnalysis?.executiveSummary ??
      (eligibleGroups.length > 0
        ? `${eligibleGroups.length} prompt–surface groups have completed their repeat requirement. Metrics below exclude incomplete groups.`
        : "Runs exist, but none meet the required repeat count yet."),
    crewAnalysis,
    metrics: [
      metric(
        "Verified mention rate",
        percentage(visibleWeight, eligibleWeight),
        "Weighted share of completed controlled-run groups that mention the confirmed entity.",
      ),
      metric(
        "Owned citation share",
        percentage(ownedCitations.length, resolvedCitations.length),
        "Resolved owned citations divided by all resolved citations; it is not an answer-visibility score.",
      ),
    ],
    topicRows: project.topics
      .filter((topic) => topic.included)
      .map((topic) => {
        const topicGroups = groups.filter(
          (group) => group.topicId === topic.id,
        );
        const eligible = topicGroups.filter(
          (group) => group.confidence !== "insufficient",
        );
        const brandPresence = average(
          eligible.map((group) => group.brandMentionRate),
        );
        return {
          topic: topic.statement,
          intent: `${topic.buyerIntent} · ${topic.commercialValue} value`,
          evidence: eligible.length
            ? `${formatPercent(brandPresence)} verified brand presence across ${eligible.length} prompt–surface group${eligible.length === 1 ? "" : "s"}.`
            : "Signal detected, not yet strong enough to recommend action.",
          nextAction:
            actions.find((action) =>
              action.affectedPromptIds.some((id) =>
                topicGroups.some((group) => group.promptId === id),
              ),
            )?.action ?? "Collect repeated answer and citation evidence first.",
        };
      }),
    sourceMapMessage: sourceMapMessage(resolvedCitations),
    narrativeMessage:
      completedExcerpts > 0
        ? `${completedExcerpts} completed answer excerpts are available. Narrative fidelity remains pending a reviewed parser instead of a sentiment guess.`
        : "Observed positioning is unavailable until verified answer excerpts are collected across selected surfaces.",
    competitorMessage:
      "Competitor comparisons remain evidence drill-downs. AnswerLint does not infer an average rank or a win/loss score from prose.",
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
    leadership,
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
    const competitorSources = group.citations.filter(
      (citation) =>
        citation.sourceType === "competitor" &&
        citation.verificationStatus === "claim_supported",
    );
    const ownedSources = group.citations.filter(
      (citation) =>
        citation.sourceType === "owned" &&
        citation.verificationStatus === "claim_supported",
    );
    const common = {
      affectedPromptIds: [prompt.id],
      markets: [prompt.market],
      surfaces: [group.surface],
      confidence: group.confidence,
      status: "actionable" as const,
    };

    if (group.brandMentionRate === 0 && competitorSources.length > 0) {
      return [
        {
          id: `comparison-${group.promptId}-${group.surface}`,
          action: `Create a comparison page for ${project.intake.brandName} and the confirmed alternatives in “${topic.statement}”.`,
          whyNow: `The brand was absent across ${group.runs.length} verified runs while ${competitorSources.length} resolved competitor source${competitorSources.length === 1 ? " was" : "s were"} cited.`,
          expectedImpact: "recommendation" as const,
          owner: "content" as const,
          effort: "medium" as const,
          dependency: "Confirm legal and product-marketing comparison claims.",
          verificationRule: `Improve verified brand presence for “${prompt.text}” across ${project.intake.runtimePolicy.repeatRuns} fresh runs.`,
          ...common,
        },
      ];
    }

    if (group.brandMentionRate > 0 && ownedSources.length === 0) {
      return [
        {
          id: `owned-citation-${group.promptId}-${group.surface}`,
          action: `Strengthen an owned page for “${topic.statement}” with a directly answerable claim and supporting proof.`,
          whyNow: `The brand appeared in ${formatPercent(group.brandMentionRate)} of verified runs, but none of the ${group.citations.filter((citation) => citation.resolved).length} resolved citations pointed to an owned source.`,
          expectedImpact: "citation" as const,
          owner: "seo" as const,
          effort: "medium" as const,
          dependency: null,
          verificationRule: `Increase the resolved owned-citation rate for “${prompt.text}” without reducing repeat-tested presence.`,
          ...common,
        },
      ];
    }

    return [];
  });
}

function unmeasuredReport(
  project: VisibilityProject,
): VisibilityWorkspaceReport {
  const measurementState =
    project.state === "benchmarking" || project.state === "benchmark_queued"
      ? "measuring"
      : project.state === "ready_to_benchmark"
        ? "awaiting_evidence"
        : "planning";
  const evidenceReason =
    "Not measured yet — no verified answer runs are available.";
  const leadership = buildLeadershipPage(project, { runs: [] }, [], []);

  return {
    state: measurementState,
    executiveBrief:
      "No answer-visibility claim is shown until official surface runs and source verification are complete.",
    crewAnalysis: null,
    metrics: ["Verified mention rate", "Owned citation share"].map((label) =>
      metric(label, null, evidenceReason),
    ),
    topicRows: project.topics
      .filter((topic) => topic.included)
      .map((topic) => ({
        topic: topic.statement,
        intent: `${topic.buyerIntent} · ${topic.commercialValue} value`,
        evidence: "Not run",
        nextAction: "Collect repeated answer and citation evidence first.",
      })),
    sourceMapMessage:
      "No sources are classified yet. Verified owned, earned, competitor, and unstable sources appear here only after citations resolve.",
    narrativeMessage:
      "Observed positioning is unavailable until verified answer excerpts are collected across selected surfaces.",
    competitorMessage:
      "Competitor comparisons remain evidence drill-downs. AnswerLint does not infer an average rank or a win/loss score from prose.",
    actionQueueMessage:
      "Signal detected, not yet strong enough to recommend action. The Action Queue opens only when the answer, citation, resolved source, claim relationship, and repeat threshold all pass.",
    actions: [],
    measurementCoverage: {
      plannedRuns: plannedRunCount(project),
      completedRuns: 0,
      percentage: null,
    },
    evidenceRows: [],
    sourceRows: [],
    leadership,
  };
}

const LEADERSHIP_METHOD =
  "The same buyer questions are asked more than once. Citation share counts resolved sources. A prompt counts as missing only when you are absent every time.";

/**
 * The first page of a visibility workspace. It answers four leadership
 * questions and withholds a fix until repeated runs support it.
 */
export function buildLeadershipPage(
  project: VisibilityProject,
  evidence: VisibilityEvidence,
  groups: EvidenceGroup[],
  actions: VisibilityAction[],
): LeadershipPage {
  const eligible = groups.filter((group) => group.confidence !== "insufficient");
  const status: LeadershipPage["status"] =
    evidence.runs.length === 0 ? "waiting" : eligible.length === 0 ? "partial" : "ready";
  const allCitations = evidence.runs.flatMap((run) => run.citations);
  const resolvedCitations = allCitations.filter((citation) => citation.resolved);
  const citationShare =
    status === "ready"
      ? buildCitationShare(project, allCitations)
      : blankCitationShare(project);
  const missingPrompts = buildMissingPrompts(project, eligible);
  const named = eligible.filter((group) => group.brandMentionRate > 0).length;
  const you = citationShare.find((row) => row.role === "you");
  const fixes = status === "ready" ? buildLeadershipFixes(project, eligible, actions) : [];

  return {
    status,
    headline: leadershipHeadline(project, status, you?.share ?? null, named, eligible.length, missingPrompts.length),
    method: LEADERSHIP_METHOD,
    citationShare,
    citationNote: citationNote(status, resolvedCitations.length),
    namedInPrompts:
      status === "ready"
        ? `Named in ${named} of ${eligible.length} completed prompts. Being named and being the cited source are counted separately.`
        : "Being named in an answer and being the cited source are counted separately. A mention without your URL does not raise citation share.",
    missingPrompts,
    missingNote: missingNote(status, missingPrompts.length),
    technicalChecks: buildTechnicalChecks(project, evidence, groups, eligible),
    fixes,
    fixesNote: fixesNote(status, fixes.length),
  };
}

function leadershipHeadline(
  project: VisibilityProject,
  status: LeadershipPage["status"],
  yourShare: number | null,
  named: number,
  completedPrompts: number,
  missing: number,
) {
  if (status === "waiting") {
    return "Approve the questions. This page fills in from repeated runs.";
  }
  if (status === "partial") {
    return "Repeats are still in progress. A prompt is not marked missing until every planned run finishes.";
  }
  const share =
    yourShare === null
      ? "Citation share is still blank."
      : `${project.intake.brandName} has ${yourShare}% of resolved citations.`;
  const presence =
    missing === 0
      ? `Named in ${named} of ${completedPrompts} completed prompts.`
      : `Missing from ${missing} of ${completedPrompts} completed prompts.`;
  return `${share} ${presence}`;
}

function citationNote(status: LeadershipPage["status"], resolved: number) {
  if (status === "ready") {
    return resolved > 0
      ? `${resolved} resolved citation${resolved === 1 ? "" : "s"} are in the share. Unopened URLs are left out.`
      : "The repeats finished, and no cited URL resolved, so the share stays blank.";
  }
  if (status === "partial" && resolved > 0) {
    return `${resolved} citation${resolved === 1 ? "" : "s"} resolved so far. Share is published when the repeats finish.`;
  }
  return "Share stays blank until the repeats finish and a cited URL resolves. An unopened link is not treated as zero.";
}

function blankCitationShare(project: VisibilityProject): LeadershipCitationRow[] {
  const competitors = project.intake.competitors.filter((competitor) => competitor.name.trim());
  return [
    { name: project.intake.brandName, role: "you", citations: 0, share: null },
    ...competitors.map((competitor) => ({
      name: competitor.name,
      role: "competitor" as const,
      citations: 0,
      share: null,
    })),
  ];
}

function missingNote(status: LeadershipPage["status"], missing: number) {
  if (status === "waiting") {
    return "Questions where you are absent on every repeat will be listed here.";
  }
  if (status === "partial") {
    return "Questions have been asked, but not enough times to decide that you are missing.";
  }
  return missing === 0
    ? "You appeared at least once in every completed prompt."
    : "You were absent on every repeat of these questions.";
}

function fixesNote(status: LeadershipPage["status"], count: number) {
  if (status === "waiting") {
    return "Five fixes are listed after the repeats agree. The first ones are prompts where a competitor is cited and you are not.";
  }
  if (status === "partial") {
    return "Fixes stay blank until each question has finished its repeats.";
  }
  if (count === 0) {
    return "No fix met the bar. One is added when a repeated run shows a competitor cited, your page missing, or a citation that does not hold up.";
  }
  if (count < 5) {
    return `${count} of 5 fixes are supported by repeated runs. The rest stay blank.`;
  }
  return "Ordered by prompts where a competitor is cited and you are not, then by citation gaps.";
}

function buildCitationShare(
  project: VisibilityProject,
  citations: CitationEvidence[],
): LeadershipCitationRow[] {
  const resolved = citations.filter((citation) => citation.resolved);
  const competitors = project.intake.competitors.filter((competitor) => competitor.name.trim());
  if (!resolved.length) {
    return [
      { name: project.intake.brandName, role: "you", citations: 0, share: null },
      ...competitors.map((competitor) => ({
        name: competitor.name,
        role: "competitor" as const,
        citations: 0,
        share: null,
      })),
    ];
  }

  const rows: LeadershipCitationRow[] = [
    { name: project.intake.brandName, role: "you", citations: 0, share: null },
    ...competitors.map((competitor) => ({
      name: competitor.name,
      role: "competitor" as const,
      citations: 0,
      share: null,
    })),
  ];
  let otherCompetitors = 0;
  let independent = 0;

  for (const citation of resolved) {
    if (citation.sourceType === "owned") {
      rows[0].citations += 1;
      continue;
    }
    const matched = competitorNameForCitation(citation, competitors);
    const competitorRow = matched
      ? rows.find((row) => row.role === "competitor" && row.name === matched)
      : undefined;
    if (competitorRow) {
      competitorRow.citations += 1;
      continue;
    }
    if (citation.sourceType === "competitor") otherCompetitors += 1;
    else independent += 1;
  }

  if (otherCompetitors > 0) {
    rows.push({
      name: "Other competitor sources",
      role: "other",
      citations: otherCompetitors,
      share: null,
    });
  }
  if (independent > 0) {
    rows.push({
      name: "Other cited sources",
      role: "independent",
      citations: independent,
      share: null,
    });
  }

  const shares = allocateShares(rows.map((row) => row.citations));
  return rows.map((row, index) => ({ ...row, share: shares[index] ?? 0 }));
}

function buildMissingPrompts(
  project: VisibilityProject,
  eligible: EvidenceGroup[],
): LeadershipMissingPrompt[] {
  return eligible
    .filter((group) => group.brandMentionRate === 0)
    .map((group) => ({
      promptId: group.promptId,
      prompt:
        project.prompts.find((prompt) => prompt.id === group.promptId)?.text ??
        "Unknown prompt",
      citedInstead: citedInstead(project, group),
      runs: group.runs.length,
    }));
}

function buildTechnicalChecks(
  project: VisibilityProject,
  evidence: VisibilityEvidence,
  groups: EvidenceGroup[],
  eligible: EvidenceGroup[],
): LeadershipTechnicalCheck[] {
  const includedPrompts = project.prompts.filter((prompt) => prompt.included);
  const citations = evidence.runs.flatMap((run) => run.citations);
  const resolved = citations.filter((citation) => citation.resolved);
  const supported = resolved.filter((citation) => citationSupportsClaim(citation));
  const owned = resolved.filter((citation) => citation.sourceType === "owned");
  const competitors = project.intake.competitors.filter((competitor) => competitor.name.trim());
  const competitorsWithUrls = competitors.filter((competitor) => competitor.url.trim());
  const promptGroups = new Set(groups.map((group) => group.promptId));
  const finished = includedPrompts.filter((prompt) =>
    eligible.some((group) => group.promptId === prompt.id),
  ).length;

  const repeats: LeadershipTechnicalCheck =
    evidence.runs.length === 0
      ? {
          id: "repeats",
          label: "Repeated questions",
          status: "waiting",
          detail: `${includedPrompts.length} questions are planned. Each one is asked ${project.intake.runtimePolicy.repeatRuns} time${project.intake.runtimePolicy.repeatRuns === 1 ? "" : "s"} before it counts.`,
        }
      : finished === includedPrompts.length && includedPrompts.length > 0
        ? {
            id: "repeats",
            label: "Repeated questions",
            status: "pass",
            detail: `${finished} of ${includedPrompts.length} questions finished their repeats.`,
          }
        : {
            id: "repeats",
            label: "Repeated questions",
            status: promptGroups.size > 0 ? "partial" : "waiting",
            detail: `${finished} of ${includedPrompts.length} questions have finished their repeats. ${evidence.runs.length} runs are stored.`,
          };

  const opens: LeadershipTechnicalCheck =
    citations.length === 0
      ? {
          id: "urls-open",
          label: "Cited URLs open",
          status: "waiting",
          detail: "Checked after an answer cites a URL.",
        }
      : resolved.length === citations.length
        ? {
            id: "urls-open",
            label: "Cited URLs open",
            status: "pass",
            detail: `${resolved.length} of ${citations.length} cited URLs resolved.`,
          }
        : {
            id: "urls-open",
            label: "Cited URLs open",
            status: resolved.length === 0 ? "needs_work" : "partial",
            detail: `${resolved.length} of ${citations.length} cited URLs resolved.`,
          };

  const ownedCheck: LeadershipTechnicalCheck =
    resolved.length === 0
      ? {
          id: "owned-cited",
          label: "Your pages are cited",
          status: "waiting",
          detail: "Counted when a resolved citation is on your domain.",
        }
      : owned.length > 0
        ? {
            id: "owned-cited",
            label: "Your pages are cited",
            status: "pass",
            detail: `${owned.length} of ${resolved.length} resolved citations are on your site.`,
          }
        : {
            id: "owned-cited",
            label: "Your pages are cited",
            status: "needs_work",
            detail: `0 of ${resolved.length} resolved citations are on your site.`,
          };

  const support: LeadershipTechnicalCheck =
    resolved.length === 0
      ? {
          id: "claim-support",
          label: "Cited pages support the claim",
          status: "waiting",
          detail: "A URL can open without the page text supporting the claim.",
        }
      : supported.length === resolved.length
        ? {
            id: "claim-support",
            label: "Cited pages support the claim",
            status: "pass",
            detail: `${supported.length} of ${resolved.length} resolved pages support the claim.`,
          }
        : {
            id: "claim-support",
            label: "Cited pages support the claim",
            status: supported.length === 0 ? "needs_work" : "partial",
            detail: `${supported.length} of ${resolved.length} resolved pages support the claim.`,
          };

  const comparison: LeadershipTechnicalCheck =
    competitors.length === 0
      ? {
          id: "competitors",
          label: "Competitors can be compared",
          status: "needs_work",
          detail: "Add the competitor names you want on the citation chart.",
        }
      : competitorsWithUrls.length === 0
        ? {
            id: "competitors",
            label: "Competitors can be compared",
            status: "partial",
            detail: "Names are saved. Add their sites so a citation can be matched to a competitor.",
          }
        : {
            id: "competitors",
            label: "Competitors can be compared",
            status: "pass",
            detail: `Citations are matched to ${competitorsWithUrls.map((competitor) => competitor.name).join(", ")}.`,
          };

  return [repeats, opens, ownedCheck, support, comparison];
}

function buildLeadershipFixes(
  project: VisibilityProject,
  eligible: EvidenceGroup[],
  actions: VisibilityAction[],
): LeadershipFix[] {
  const drafts: Array<{ priority: number; title: string; why: string; evidence: string }> = [];
  const coveredPrompts = new Set<string>();

  for (const action of actions) {
    if (action.id.startsWith("crew-")) continue;
    const promptId = action.affectedPromptIds[0];
    const prompt = project.prompts.find((item) => item.id === promptId);
    const topic = prompt
      ? project.topics.find((item) => item.id === prompt.topicId)
      : undefined;
    if (action.id.startsWith("comparison-")) {
      drafts.push({
        priority: 1,
        title: `Show up for “${clip(prompt?.text ?? topic?.statement ?? "this buyer question")}”`,
        why: "You were absent on every repeated run, and a competitor source was cited.",
        evidence: action.whyNow,
      });
    } else if (action.id.startsWith("owned-citation-")) {
      drafts.push({
        priority: 3,
        title: `Get your own page cited for “${clip(topic?.statement ?? prompt?.text ?? "this topic")}”`,
        why: "The answer names you, but none of the resolved citations are on your site.",
        evidence: action.whyNow,
      });
    } else {
      drafts.push({
        priority: 3,
        title: clip(action.action, 140),
        why: action.whyNow,
        evidence: action.verificationRule,
      });
    }
    for (const id of action.affectedPromptIds) coveredPrompts.add(id);
  }

  for (const group of eligible) {
    if (coveredPrompts.has(group.promptId) || group.brandMentionRate > 0) continue;
    const prompt = project.prompts.find((item) => item.id === group.promptId);
    const cited = citedInstead(project, group);
    drafts.push({
      priority: 2,
      title: `Answer “${clip(prompt?.text ?? "this buyer question")}” on your site`,
      why: cited.length
        ? `You were absent on all ${group.runs.length} repeats. Cited instead: ${cited.join(", ")}.`
        : `You were absent on all ${group.runs.length} repeats. No competitor citation was verified, so publish a direct answer before a comparison page.`,
      evidence: prompt?.text ?? group.promptId,
    });
    coveredPrompts.add(group.promptId);
  }

  const eligibleCitations = eligible.flatMap((group) => group.citations);
  const unresolved = eligibleCitations.filter((citation) => !citation.resolved).length;
  if (unresolved > 0) {
    drafts.push({
      priority: 4,
      title: "Drop citations that do not open",
      why: `${unresolved} cited URL${unresolved === 1 ? "" : "s"} did not resolve, so ${unresolved === 1 ? "it is" : "they are"} excluded from citation share.`,
      evidence: "Counted on prompts that finished their repeats.",
    });
  }
  const unsupported = eligibleCitations.filter(
    (citation) => citation.resolved && !citationSupportsClaim(citation),
  ).length;
  if (unsupported > 0) {
    drafts.push({
      priority: 5,
      title: "Replace citations that do not support the claim",
      why: `${unsupported} resolved page${unsupported === 1 ? "" : "s"} opened, but the page text did not support the claim being checked.`,
      evidence: "Opening a URL and supporting the claim are separate checks.",
    });
  }

  for (const action of actions) {
    if (!action.id.startsWith("crew-")) continue;
    if (action.affectedPromptIds.some((id) => coveredPrompts.has(id))) continue;
    drafts.push({
      priority: 6,
      title: clip(action.action, 140),
      why: action.whyNow,
      evidence: action.verificationRule,
    });
  }

  return drafts
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 5)
    .map((draft, index) => ({
      rank: index + 1,
      title: draft.title,
      why: draft.why,
      evidence: draft.evidence,
    }));
}

function citedInstead(project: VisibilityProject, group: EvidenceGroup) {
  const names = new Set<string>();
  for (const run of group.runs) {
    for (const name of run.observation.competitorMentions) {
      if (name.trim()) names.add(name.trim());
    }
    for (const citation of run.citations) {
      if (!citation.resolved) continue;
      const matched = competitorNameForCitation(citation, project.intake.competitors);
      if (matched) names.add(matched);
      else if (citation.sourceType === "competitor") {
        names.add(sourceDomain(citation.canonicalUrl ?? citation.url));
      }
    }
  }
  return [...names].slice(0, 4);
}

function competitorNameForCitation(
  citation: CitationEvidence,
  competitors: VisibilityProject["intake"]["competitors"],
) {
  const host = sourceDomain(citation.canonicalUrl ?? citation.url);
  if (!host || host === "Unresolved URL") return null;
  for (const competitor of competitors) {
    if (!competitor.name.trim() || !competitor.url.trim()) continue;
    const competitorHost = sourceDomain(competitor.url);
    if (!competitorHost || competitorHost === "Unresolved URL") continue;
    if (host === competitorHost || host.endsWith(`.${competitorHost}`)) {
      return competitor.name;
    }
  }
  return null;
}

function citationSupportsClaim(citation: CitationEvidence) {
  if (citation.verificationStatus) return citation.verificationStatus === "claim_supported";
  return citation.supportsClaim;
}

function allocateShares(counts: number[]) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total) return counts.map(() => 0);
  const exact = counts.map((count) => (count / total) * 100);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (const item of order) {
    if (remainder <= 0) break;
    floors[item.index] += 1;
    remainder -= 1;
  }
  return floors;
}

function clip(value: string, max = 96) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function mergeVisibilityActions(
  deterministic: VisibilityAction[],
  analysis: VisibilityCrewAnalysis | null,
): VisibilityAction[] {
  if (!analysis) return deterministic;
  const generated = analysis.actions
    .filter((action) => action.confidence !== "insufficient")
    .map<VisibilityAction>((action, index) => ({
      id: `crew-${analysis.analysisId}-${index}`,
      action: action.title,
      whyNow: `${action.whyNow} Target page: ${action.linkedPageUrl}`,
      expectedImpact: "narrative_correction",
      owner: action.owner,
      effort: action.effort,
      dependency: action.acceptanceCriteria.join(" · "),
      affectedPromptIds: action.affectedPromptIds,
      markets: [],
      surfaces: ["chatgpt_search"],
      confidence: action.confidence,
      verificationRule: action.retestRule,
      status: "actionable",
    }));
  return [...generated, ...deterministic].slice(0, 12);
}

function plannedRunCount(project: VisibilityProject) {
  const includedTopics = new Set(
    project.topics.filter((topic) => topic.included).map((topic) => topic.id),
  );
  return project.prompts
    .filter((prompt) => prompt.included && includedTopics.has(prompt.topicId))
    .reduce(
      (count, prompt) => count + prompt.surfaces.length * prompt.plannedSamples,
      0,
    );
}

function toEvidenceRows(
  project: VisibilityProject,
  runs: CollectedVisibilityRun[],
) {
  const countsByGroup = new Map<string, number>();
  for (const run of runs) {
    const key = `${run.promptId}:${run.surface}`;
    countsByGroup.set(key, (countsByGroup.get(key) ?? 0) + 1);
  }
  return [...runs]
    .sort((left, right) => (right.runAt ?? "").localeCompare(left.runAt ?? ""))
    .map((run) => {
      const completedGroupRuns =
        countsByGroup.get(`${run.promptId}:${run.surface}`) ?? 0;
      const confidence = repeatConfidence(
        run.observation.answerObserved,
        completedGroupRuns,
        project.intake.runtimePolicy.repeatRuns,
      );
      return {
        runId: run.runId,
        prompt:
          project.prompts.find((prompt) => prompt.id === run.promptId)?.text ??
          "Unknown prompt",
        topic:
          project.topics.find((topic) => topic.id === run.topicId)?.statement ??
          "Unknown topic",
        surface: run.surface,
        market: run.market,
        runAt: run.runAt ?? "",
        modelRuntime: run.modelRuntime ?? "Recorded provider",
        answerExcerpt: run.answerExcerpt ?? null,
        brandMentioned: run.observation.brandMentioned,
        recommendationStrength: run.observation.recommendationStrength,
        rankedPosition: run.observation.rankedPosition,
        confidence,
        status:
          run.runStatus === "partial" || confidence === "insufficient"
            ? ("partial" as const)
            : ("measured" as const),
        citations: run.citations,
      };
    });
}

function toSourceRows(citations: CitationEvidence[]) {
  const grouped = new Map<
    string,
    {
      url: string;
      domain: string;
      sourceType: CitationEvidence["sourceType"];
      citationCount: number;
      resolvedCount: number;
      supportingCount: number;
    }
  >();
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
      supportingCount:
        (existing?.supportingCount ?? 0) + Number(citation.supportsClaim),
    });
  }
  return [...grouped.values()].sort(
    (left, right) => right.citationCount - left.citationCount,
  );
}

function sourceDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "Unresolved URL";
  }
}

function metric(
  label: string,
  value: number | null,
  reason: string,
): VisibilityMetric {
  return { label, value, reason };
}

function rate(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function repeatConfidence(
  answersObserved: boolean,
  completedRepeatCount: number,
  requiredRepeatCount: number,
): EvidenceConfidence {
  if (!answersObserved || completedRepeatCount < requiredRepeatCount)
    return "insufficient";
  return completedRepeatCount >= 3 ? "high" : "medium";
}

function percentage(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : null;
}

function average(values: number[]) {
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function sourceMapMessage(citations: CitationEvidence[]) {
  if (!citations.length)
    return "No citation source resolved yet; unverified sources remain excluded from reporting.";
  const count = (type: CitationEvidence["sourceType"]) =>
    citations.filter((citation) => citation.sourceType === type).length;
  return `${count("owned")} owned, ${count("earned")} earned, and ${count("competitor")} competitor resolved citation${citations.length === 1 ? "" : "s"} are mapped by prompt, surface, and market.`;
}
