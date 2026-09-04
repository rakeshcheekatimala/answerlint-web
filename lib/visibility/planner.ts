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

export function createVisibilityProjectDraft(
  input: VisibilityIntake,
): VisibilityProject {
  const now = new Date().toISOString();
  const brandCard = createBrandIntelligenceCard(input);
  const topics = createTopicMap(input);
  const prompts = createPromptPlans(input, topics);
  const promptsPerTopic = new Map<string, number>();
  for (const prompt of prompts) {
    promptsPerTopic.set(
      prompt.topicId,
      (promptsPerTopic.get(prompt.topicId) ?? 0) +
        prompt.surfaces.length * prompt.plannedSamples,
    );
  }
  const topicsWithCounts = topics.map((topic) => ({
    ...topic,
    promptCount: promptsPerTopic.get(topic.id) ?? 0,
  }));

  return {
    id: crypto.randomUUID(),
    ownerMode: "anonymous",
    state: "awaiting_brand_approval",
    intake: input,
    brandCard,
    topics: topicsWithCounts,
    prompts,
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
  const description =
    input.description || `${input.brandName} helps ${input.targetCustomers}.`;
  const competitorNames = input.competitors.map(
    (competitor) => competitor.name,
  );

  return {
    canonicalName: input.brandName,
    aliases: [input.brandName],
    valueProposition: description,
    idealCustomerProfile: input.targetCustomers,
    products: [input.primaryCategory],
    locations: input.markets,
    people: [],
    // This is user-supplied positioning, not a discovered fact. Approval turns
    // it into the exact baseline claim used by citation verification.
    claims: [description],
    pricingSignals: [],
    existingNarrative: `${input.brandName} is positioned around ${input.primaryCategory} for ${input.targetCustomers}.`,
    ambiguityRisks:
      competitorNames.length > 0
        ? [
            `Confirm how ${input.brandName} differs from ${competitorNames.join(", ")}.`,
          ]
        : ["Add confirmed competitors before decision-mode benchmarking."],
    initialOwnedAssets: [
      {
        url: canonicalUrl.toString(),
        reason:
          "Submitted brand URL; verification is pending the evidence crawl.",
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
  const competitorNames = input.competitors.map(
    (competitor) => competitor.name,
  );
  const primaryUseCase = input.keyUseCases[0];
  const secondaryUseCase = input.keyUseCases[1] ?? primaryUseCase;

  return [
    createTopic({
      statement: `Best ${input.primaryCategory} for ${input.targetCustomers}`,
      buyerIntent: "discover",
      funnelStage: "awareness",
      commercialValue: "medium",
      evidenceGap:
        "Establish clear category relevance and a trustworthy owned source.",
    }),
    createTopic({
      statement: `Trust and risk checks for ${input.primaryCategory}`,
      buyerIntent: "evaluate",
      funnelStage: "decision",
      commercialValue: "high",
      evidenceGap:
        "Establish the proof, implementation, and risk details a buyer needs before acting.",
    }),
    createTopic({
      statement: `Buyer job · ${formatBuyerJob(primaryUseCase)}`,
      buyerIntent: "evaluate",
      funnelStage: "consideration",
      commercialValue: "high",
      evidenceGap:
        "Strengthen use-case proof, citations, and comparison evidence.",
    }),
    createTopic({
      statement:
        competitorNames.length > 0
          ? `${input.brandName} alternatives · ${formatBuyerJob(secondaryUseCase)}`
          : `${input.brandName} evidence · ${formatBuyerJob(secondaryUseCase)}`,
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
  const [discoveryTopic, trustTopic, useCaseTopic, narrativeTopic] = topics;
  const competitor = input.competitors[0]?.name;
  const candidates: Array<{
    topic: TopicMapItem;
    text: string;
    kind: PromptPlan["kind"];
    buyerRealism: PromptPlan["buyerRealism"];
    whySelected: string;
  }> = [
    {
      topic: discoveryTopic,
      text: `What are the best ${input.primaryCategory} options for ${input.targetCustomers}?`,
      kind: "category_discovery",
      buyerRealism: "buyer_realistic",
      whySelected:
        "Tests whether the brand enters an unaided category shortlist.",
    },
    ...input.keyUseCases.map((useCase) => ({
      topic: useCaseTopic,
      text: `How should ${input.targetCustomers} ${normalizeBuyerJob(useCase)}?`,
      kind: "use_case_evaluation" as const,
      buyerRealism: "buyer_realistic" as const,
      whySelected: `Preserves the submitted buyer job “${useCase}” as an independently discardable prompt.`,
    })),
    {
      topic: narrativeTopic,
      text: `What is ${input.brandName} best known for, and what sources support that description?`,
      kind: "brand_narrative",
      buyerRealism: "brand_controlled",
      whySelected:
        "Checks whether the observed brand narrative is accurate and source-backed.",
    },
  ];

  const optional = [
    {
      topic: trustTopic,
      text: `What proof should ${input.targetCustomers} require before choosing ${input.primaryCategory}?`,
      kind: "proof_and_trust" as const,
      buyerRealism: "buyer_realistic" as const,
      whySelected:
        "Reveals which claims and sources establish trust for a high-stakes decision.",
    },
    ...(competitor
      ? [
          {
            topic: narrativeTopic,
            text: `How does ${input.brandName} compare with ${competitor} for ${input.keyUseCases[0]}?`,
            kind: "comparison" as const,
            buyerRealism: "buyer_realistic" as const,
            whySelected:
              "Tests a confirmed alternative without inventing a synthetic rank.",
          },
        ]
      : []),
    {
      topic: discoveryTopic,
      text: `Which ${input.primaryCategory} providers should ${input.targetCustomers} evaluate first?`,
      kind: "category_discovery" as const,
      buyerRealism: "buyer_realistic" as const,
      whySelected: "Reduces dependence on a single category-discovery wording.",
    },
    {
      topic: useCaseTopic,
      text: `What evidence should ${input.targetCustomers} use to ${normalizeBuyerJob(input.keyUseCases[0])}?`,
      kind: "use_case_evaluation" as const,
      buyerRealism: "buyer_realistic" as const,
      whySelected:
        "Surfaces the decision criteria and proof expected for the highest-priority buyer job.",
    },
    {
      topic: trustTopic,
      text: `When might ${input.primaryCategory} be a poor fit for ${input.targetCustomers}?`,
      kind: "negative_risk" as const,
      buyerRealism: "diagnostic" as const,
      whySelected:
        "Checks whether limitations and fit are represented accurately, not just positive claims.",
    },
  ];

  // At three repeats, eight prompts remain under the 28-call safety budget.
  // Every submitted buyer job is retained before optional variants are added.
  const templates = [...candidates, ...optional].slice(0, 8);
  return templates.map(({ topic, ...template }) => ({
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
    included: true,
    status: "planned",
  }));
}

function normalizeBuyerJob(useCase: string) {
  const job = useCase.trim().replace(/[?.!]+$/, "");
  if (!job) return "evaluate the available options";

  return `${job.charAt(0).toLowerCase()}${job.slice(1)}`;
}

function formatBuyerJob(useCase: string) {
  const job = normalizeBuyerJob(useCase);
  return `${job.charAt(0).toUpperCase()}${job.slice(1)}`;
}
