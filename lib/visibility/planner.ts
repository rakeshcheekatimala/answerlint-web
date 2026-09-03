import crypto from "node:crypto";

import type {
  BrandIntelligenceCard,
  BuyerIntent,
  PromptPlan,
  TopicMapItem,
  VisibilityProject,
} from "@/lib/visibility/types";
import type { VisibilityIntake } from "@/lib/visibility/schema";
export { applyProjectApprovals } from "@/lib/visibility/lifecycle";

export function createVisibilityProjectDraft(input: VisibilityIntake): VisibilityProject {
  const now = new Date().toISOString();
  const brandCard = createBrandIntelligenceCard(input);
  const topics = createTopicMap(input);

  return {
    id: crypto.randomUUID(),
    ownerMode: "anonymous",
    state: "awaiting_brand_approval",
    intake: input,
    brandCard,
    topics,
    prompts: createPromptPlans(input, topics),
    actions: [],
    createdAt: now,
    updatedAt: now,
    storageStatus: "skipped",
  };
}

export function createBrandIntelligenceCard(
  input: VisibilityIntake,
): BrandIntelligenceCard {
  const canonicalUrl = new URL(input.brandUrl);
  const description = input.description || `${input.brandName} helps ${input.targetCustomers}.`;
  const competitorNames = input.competitors.map((competitor) => competitor.name);

  return {
    canonicalName: input.brandName,
    aliases: [input.brandName],
    valueProposition: description,
    idealCustomerProfile: input.targetCustomers,
    products: [input.primaryCategory],
    locations: input.markets,
    people: [],
    claims: [],
    pricingSignals: [],
    existingNarrative: `${input.brandName} is positioned around ${input.primaryCategory} for ${input.targetCustomers}.`,
    ambiguityRisks:
      competitorNames.length > 0
        ? [`Confirm how ${input.brandName} differs from ${competitorNames.join(", ")}.`]
        : ["Add confirmed competitors before decision-mode benchmarking."],
    initialOwnedAssets: [
      {
        url: canonicalUrl.toString(),
        reason: "Submitted brand URL; verification is pending the evidence crawl.",
        verificationStatus: "pending",
      },
    ],
    health: {
      crawl: "pending",
      index: "pending",
      canonical: "pending",
      schema: "pending",
      access: "pending",
    },
    approvalStatus: "pending",
    approvedAt: null,
  };
}

export function createTopicMap(input: VisibilityIntake): TopicMapItem[] {
  const [market] = input.markets;
  const [language] = input.languages;
  const competitorNames = input.competitors.map((competitor) => competitor.name);
  const primaryUseCase = input.keyUseCases[0];
  const secondaryUseCase = input.keyUseCases[1] ?? primaryUseCase;

  return [
    createTopic({
      statement: `Best ${input.primaryCategory} for ${input.targetCustomers}`,
      buyerIntent: "discover",
      funnelStage: "awareness",
      commercialValue: "medium",
      evidenceGap: "Establish clear category relevance and a trustworthy owned source.",
    }),
    createTopic({
      statement: `Trust and risk checks for ${input.primaryCategory}`,
      buyerIntent: "evaluate",
      funnelStage: "decision",
      commercialValue: "high",
      evidenceGap: "Establish the proof, implementation, and risk details a buyer needs before acting.",
    }),
    createTopic({
      statement: `${input.primaryCategory} for ${primaryUseCase}`,
      buyerIntent: "evaluate",
      funnelStage: "consideration",
      commercialValue: "high",
      evidenceGap: "Strengthen use-case proof, citations, and comparison evidence.",
    }),
    createTopic({
      statement:
        competitorNames.length > 0
          ? `${input.brandName} alternatives and comparison for ${secondaryUseCase}`
          : `${input.brandName} proof and trust for ${secondaryUseCase}`,
      buyerIntent: competitorNames.length > 0 ? "compare" : "evaluate",
      funnelStage: "decision",
      commercialValue: "high",
      evidenceGap:
        "Validate the answer narrative before making a content or PR recommendation.",
    }),
  ].map((topic) => ({
    id: crypto.randomUUID(),
    market,
    language,
    narrativeRelevance: `Tests whether the answer reflects ${input.brandName}'s stated value proposition.`,
    competitorNames,
    evidenceSufficiency: "unknown" as const,
    promptCount: 2 * input.surfaces.length * input.runtimePolicy.repeatRuns,
    surfaces: input.surfaces,
    included: true,
    ...topic,
  }));
}

function createTopic({
  statement,
  buyerIntent,
  funnelStage,
  commercialValue,
  evidenceGap,
}: {
  statement: string;
  buyerIntent: BuyerIntent;
  funnelStage: TopicMapItem["funnelStage"];
  commercialValue: TopicMapItem["commercialValue"];
  evidenceGap: string;
}) {
  return { statement, buyerIntent, funnelStage, commercialValue, evidenceGap };
}

export function createPromptPlans(
  input: VisibilityIntake,
  topics: TopicMapItem[],
): PromptPlan[] {
  return topics.flatMap((topic, index) =>
    promptTemplates(input, topic, index).map((template) => ({
      id: crypto.randomUUID(),
      topicId: topic.id,
      text: template.text,
      kind: template.kind,
      buyerRealism: template.buyerRealism,
      market: topic.market,
      language: topic.language,
      surfaces: topic.surfaces,
      whySelected: template.whySelected,
      importanceScore: topic.commercialValue === "high" ? 90 : 65,
      competitorEntities: topic.competitorNames,
      plannedSamples: input.runtimePolicy.repeatRuns,
      status: "planned",
    })),
  );
}

function promptTemplates(
  input: VisibilityIntake,
  topic: TopicMapItem,
  index: number,
): Array<Pick<PromptPlan, "text" | "kind" | "buyerRealism" | "whySelected">> {
  if (index === 0) {
    return [
      {
        text: `What are the best ${input.primaryCategory} options for ${input.targetCustomers}?`,
        kind: "category_discovery",
        buyerRealism: "buyer_realistic",
        whySelected: "A category-discovery prompt for the selected market and buyer profile.",
      },
      {
        text: `Which ${input.primaryCategory} providers should ${input.targetCustomers} evaluate first?`,
        kind: "category_discovery",
        buyerRealism: "buyer_realistic",
        whySelected: "A second discovery wording keeps the baseline from depending on one prompt form.",
      },
    ];
  }

  if (topic.buyerIntent === "compare") {
    const competitor = input.competitors[0]?.name ?? "leading alternatives";
    return [
      {
        text: `How does ${input.brandName} compare with ${competitor} for ${input.keyUseCases[1] ?? input.keyUseCases[0]}?`,
        kind: "comparison",
        buyerRealism: "buyer_realistic",
        whySelected: "A decision-stage head-to-head prompt limited to confirmed competitor entities.",
      },
      {
        text: `What are the trade-offs between ${input.brandName} and ${competitor} for ${input.keyUseCases[1] ?? input.keyUseCases[0]}?`,
        kind: "comparison",
        buyerRealism: "buyer_realistic",
        whySelected: "A comparison prompt that asks for constraints rather than a synthetic rank.",
      },
    ];
  }

  if (index === 1) {
    return [
      {
        text: `What should ${input.targetCustomers} use for ${input.keyUseCases[0]}?`,
        kind: "use_case_evaluation",
        buyerRealism: "buyer_realistic",
        whySelected: "A high-intent use-case prompt tied to the stated commercial goal.",
      },
      {
        text: `How should ${input.targetCustomers} evaluate ${input.primaryCategory} for ${input.keyUseCases[0]}?`,
        kind: "use_case_evaluation",
        buyerRealism: "buyer_realistic",
        whySelected: "An evaluation prompt that reveals the proof buyers look for before choosing a provider.",
      },
    ];
  }

  return [
    {
      text: `What proof should ${input.targetCustomers} require before adopting ${input.primaryCategory}?`,
      kind: "proof_and_trust",
      buyerRealism: "buyer_realistic",
      whySelected: "A trust/risk prompt tests whether the evidence a buyer needs is available in the answer.",
    },
    {
      text: `What implementation or risk questions matter when choosing ${input.primaryCategory} for ${input.keyUseCases[0]}?`,
      kind: "proof_and_trust",
      buyerRealism: "buyer_realistic",
      whySelected: "A second trust/risk prompt covers practical constraints without inferring sentiment.",
    },
  ];
}
