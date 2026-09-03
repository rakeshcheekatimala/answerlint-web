import type {
  AnswerObservation,
  CitationEvidence,
  EvidenceConfidence,
  VisibilityAction,
} from "@/lib/visibility/types";

export function canonicalizeEvidenceUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "gclid" || key === "fbclid") {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return null;
  }
}

export function assessObservation(input: {
  runId: string;
  rawAnswer: string | null;
  brandMentioned: boolean;
  competitorMentions?: string[];
  recommendationStrength: AnswerObservation["recommendationStrength"];
  rankedPosition?: number | null;
  citations: CitationEvidence[];
  completedRepeatCount: number;
  requiredRepeatCount: number;
}): AnswerObservation {
  const answerObserved = Boolean(input.rawAnswer?.trim());
  const citations = input.citations.map((citation) => ({
    ...citation,
    canonicalUrl: citation.canonicalUrl ?? canonicalizeEvidenceUrl(citation.url),
    verificationStatus:
      citation.verificationStatus ??
      (citation.resolved
        ? citation.supportsClaim
          ? "claim_supported"
          : "citation_resolved"
        : "unresolved"),
  }));
  const citationExtracted = citations.some((citation) => Boolean(citation.canonicalUrl));
  const sourceResolved = citations.some(
    (citation) => citation.resolved && Boolean(citation.canonicalUrl),
  );
  const claimVerified = citations.some(
    (citation) => citation.supportsClaim && citation.resolved,
  );
  const confidence = evidenceConfidence({
    answerObserved,
    citationExtracted,
    sourceResolved,
    claimVerified,
    completedRepeatCount: input.completedRepeatCount,
    requiredRepeatCount: input.requiredRepeatCount,
  });

  return {
    runId: input.runId,
    answerObserved,
    brandMentioned: input.brandMentioned,
    competitorMentions: input.competitorMentions ?? [],
    recommendationStrength: input.recommendationStrength,
    rankedPosition:
      input.recommendationStrength === "ranked" ? input.rankedPosition ?? null : null,
    citations,
    confidence,
    claimVerified,
    signal:
      confidence === "insufficient"
        ? "Signal detected, not yet strong enough to recommend action."
        : "Evidence meets the verification gate for a scoped recommendation.",
  };
}

export function evidenceConfidence(input: {
  answerObserved: boolean;
  citationExtracted: boolean;
  sourceResolved: boolean;
  claimVerified: boolean;
  completedRepeatCount: number;
  requiredRepeatCount: number;
}): EvidenceConfidence {
  const gatePassed =
    input.answerObserved &&
    input.citationExtracted &&
    input.sourceResolved &&
    input.claimVerified;

  if (!gatePassed || input.completedRepeatCount < input.requiredRepeatCount) {
    return "insufficient";
  }

  return input.completedRepeatCount >= 3 ? "high" : "medium";
}

/** Prevents a report from promoting a recommendation without verified evidence. */
export function canMarkActionable(observation: AnswerObservation): boolean {
  return (
    observation.answerObserved &&
    observation.claimVerified &&
    observation.citations.some(
      (citation) => citation.resolved && citation.supportsClaim && citation.canonicalUrl,
    ) &&
    observation.confidence !== "insufficient"
  );
}

export function actionableActions(actions: VisibilityAction[]): VisibilityAction[] {
  return actions.filter((action) => action.status === "actionable");
}
