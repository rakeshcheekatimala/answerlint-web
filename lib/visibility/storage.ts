import crypto from "node:crypto";

import { createClaimToken, hashClaimToken } from "@/lib/reports/tokens";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";
import type { VisibilityEvidence } from "@/lib/visibility/reporting";
import type { VisibilityCrewAnalysis } from "@/lib/visibility/crew/types";
import type {
  AnswerObservation,
  BrandIntelligenceCard,
  CitationEvidence,
  PromptPlan,
  RunManifest,
  TopicMapItem,
  VisibilityProject,
} from "@/lib/visibility/types";

export { VISIBILITY_PROJECT_TOKEN_HEADER } from "@/lib/visibility/constants";

export const visibilityStorageSetupMessage =
  "AI Visibility storage is not installed yet. Run supabase/visibility.sql in the Supabase SQL editor, then retry.";

export class VisibilityProjectAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisibilityProjectAccessError";
  }
}

export class VisibilityStorageSetupError extends Error {
  constructor(message = visibilityStorageSetupMessage) {
    super(message);
    this.name = "VisibilityStorageSetupError";
  }
}

export class VisibilityProjectNotFoundError extends Error {
  constructor() {
    super("AI Visibility project not found.");
    this.name = "VisibilityProjectNotFoundError";
  }
}

export class VisibilityBenchmarkConflictError extends Error {
  constructor() {
    super("This benchmark cohort has already been queued or is no longer ready.");
    this.name = "VisibilityBenchmarkConflictError";
  }
}

type ProjectRow = {
  id: string;
  brand_url: string;
  brand_name: string;
  description: string;
  primary_category: string;
  target_customers: string;
  key_use_cases: string[];
  revenue_goal: VisibilityProject["intake"]["revenueGoal"];
  markets: string[];
  languages: string[];
  surfaces: VisibilityProject["intake"]["surfaces"];
  runtime_policy: VisibilityProject["intake"]["runtimePolicy"];
  state: VisibilityProject["state"];
  benchmark_progress?: VisibilityProject["benchmarkProgress"] | null;
  created_at: string;
  updated_at: string;
  owner_token_hash?: string | null;
};

type CardRow = {
  canonical_name: string;
  aliases: string[];
  value_proposition: string;
  ideal_customer_profile: string;
  products: string[];
  locations: string[];
  people: string[];
  claims: string[];
  pricing_signals: string[];
  existing_narrative: string;
  ambiguity_risks: string[];
  health: BrandIntelligenceCard["health"];
  approval_status: BrandIntelligenceCard["approvalStatus"];
  approved_at: string | null;
};

type AssetRow = {
  url: string;
  reason: string;
  verification_status: BrandIntelligenceCard["initialOwnedAssets"][number]["verificationStatus"];
};

type TopicRow = {
  id: string;
  statement: string;
  buyer_intent: TopicMapItem["buyerIntent"];
  funnel_stage: TopicMapItem["funnelStage"];
  commercial_value: TopicMapItem["commercialValue"];
  market: string;
  language: string;
  narrative_relevance: string;
  competitor_names: string[];
  evidence_sufficiency: TopicMapItem["evidenceSufficiency"];
  evidence_gap: string;
  prompt_count: number;
  surfaces: TopicMapItem["surfaces"];
  included: boolean;
};

type PromptRow = {
  id: string;
  topic_id: string;
  prompt_text: string;
  kind: PromptPlan["kind"];
  buyer_realism: PromptPlan["buyerRealism"];
  market: string;
  language: string;
  surfaces: PromptPlan["surfaces"];
  why_selected: string;
  importance_score: number;
  competitor_entities: string[];
  planned_samples: number;
  included: boolean;
  status: PromptPlan["status"];
};

type EvidenceRunRow = {
  id: string;
  prompt_id: string;
  surface: RunManifest["surface"];
  market: string;
  language: string;
  model_runtime: string;
  run_at: string;
  parser_version: string;
  raw_answer_excerpt: string | null;
  raw_answer_artifact_path: string | null;
  source_manifest_artifact_path: string | null;
  status: "complete" | "partial";
};

type ObservationRow = {
  run_id: string;
  answer_observed: boolean;
  brand_mentioned: boolean;
  competitor_mentions: string[];
  recommendation_strength: AnswerObservation["recommendationStrength"];
  ranked_position: number | null;
  confidence: AnswerObservation["confidence"];
  claim_verified: boolean;
  signal: string;
};

type CitationRow = {
  run_id: string;
  url: string;
  canonical_url: string | null;
  title: string | null;
  excerpt: string | null;
  source_type: CitationEvidence["sourceType"];
  resolved: boolean;
  verification_status: NonNullable<
    CitationEvidence["verificationStatus"]
  > | null;
  supports_claim: boolean;
};

function tokenMatchesHash(
  token: string | undefined,
  storedHash: string | null | undefined,
) {
  if (!token || !storedHash) return false;
  const presented = Buffer.from(hashClaimToken(token));
  const stored = Buffer.from(storedHash);
  return (
    presented.length === stored.length &&
    crypto.timingSafeEqual(presented, stored)
  );
}

function localProject(
  project: VisibilityProject,
  status: "skipped" | "failed",
  editToken: string,
  storageError?: string,
): VisibilityProject {
  return {
    ...project,
    id: `local_${project.id}`,
    storageStatus: status,
    storageError,
    editToken,
  };
}

/**
 * Persists each visibility concern as a relation, keeping raw runs and
 * artifacts out of the project row so later reporting stays queryable.
 */
export async function storeVisibilityProjectBestEffort(
  project: VisibilityProject,
): Promise<VisibilityProject> {
  const editToken = createClaimToken();
  if (!isSupabaseAdminConfigured())
    return localProject(project, "skipped", editToken);

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("visibility_projects")
      .insert({
        ...toProjectInsert(project),
        owner_token_hash: hashClaimToken(editToken),
      })
      .select(projectSelect)
      .single<ProjectRow>();

    if (error || !data)
      throw new Error(error?.message ?? "Unable to store project.");
    await storeProjectRelations(project, supabase);

    return {
      ...project,
      id: data.id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      storageStatus: "stored",
      editToken,
    };
  } catch (error) {
    return localProject(
      project,
      "failed",
      editToken,
      formatVisibilityStorageError(error),
    );
  }
}

async function storeProjectRelations(
  project: VisibilityProject,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
) {
  const projectId = project.id;
  const independentOperations: Array<
    PromiseLike<{ error: { message: string } | null }>
  > = [];

  if (project.intake.competitors.length) {
    independentOperations.push(
      supabase.from("visibility_competitors").insert(
        project.intake.competitors.map((competitor) => ({
          project_id: projectId,
          name: competitor.name,
          url: competitor.url || null,
        })),
      ),
    );
  }

  independentOperations.push(
    supabase.from("visibility_brand_cards").insert({
      project_id: projectId,
      canonical_name: project.brandCard.canonicalName,
      aliases: project.brandCard.aliases,
      value_proposition: project.brandCard.valueProposition,
      ideal_customer_profile: project.brandCard.idealCustomerProfile,
      products: project.brandCard.products,
      locations: project.brandCard.locations,
      people: project.brandCard.people,
      claims: project.brandCard.claims,
      pricing_signals: project.brandCard.pricingSignals,
      existing_narrative: project.brandCard.existingNarrative,
      ambiguity_risks: project.brandCard.ambiguityRisks,
      health: project.brandCard.health,
      approval_status: project.brandCard.approvalStatus,
      approved_at: project.brandCard.approvedAt,
    }),
  );

  if (project.brandCard.initialOwnedAssets.length) {
    independentOperations.push(
      supabase.from("visibility_owned_assets").insert(
        project.brandCard.initialOwnedAssets.map((asset) => ({
          project_id: projectId,
          url: asset.url,
          reason: asset.reason,
          verification_status: asset.verificationStatus,
        })),
      ),
    );
  }

  const independentResults = await Promise.all(independentOperations);
  independentResults.forEach(ensureVisibilityStorageSuccess);

  // Prompts reference topic IDs, so this insert must finish before the prompt
  // insert begins. Sending both requests concurrently can intermittently trip
  // `visibility_prompts_topic_id_fkey` in Postgres.
  if (project.topics.length) {
    const topicsResult = await supabase.from("visibility_topics").insert(
      project.topics.map((topic) => ({
        id: topic.id,
        project_id: projectId,
        statement: topic.statement,
        buyer_intent: topic.buyerIntent,
        funnel_stage: topic.funnelStage,
        commercial_value: topic.commercialValue,
        market: topic.market,
        language: topic.language,
        narrative_relevance: topic.narrativeRelevance,
        competitor_names: topic.competitorNames,
        evidence_sufficiency: topic.evidenceSufficiency,
        evidence_gap: topic.evidenceGap,
        prompt_count: topic.promptCount,
        surfaces: topic.surfaces,
        included: topic.included,
      })),
    );
    ensureVisibilityStorageSuccess(topicsResult);
  }

  if (project.prompts.length) {
    const promptsResult = await supabase.from("visibility_prompts").insert(
      project.prompts.map((prompt) => ({
        id: prompt.id,
        project_id: projectId,
        topic_id: prompt.topicId,
        prompt_text: prompt.text,
        kind: prompt.kind,
        buyer_realism: prompt.buyerRealism,
        market: prompt.market,
        language: prompt.language,
        surfaces: prompt.surfaces,
        why_selected: prompt.whySelected,
        importance_score: prompt.importanceScore,
        competitor_entities: prompt.competitorEntities,
        planned_samples: prompt.plannedSamples,
        included: prompt.included,
        status: prompt.status,
      })),
    );
    ensureVisibilityStorageSuccess(promptsResult);
  }
}

function ensureVisibilityStorageSuccess(result: {
  error: { message: string } | null;
}) {
  if (result.error) throw new Error(result.error.message);
}

export async function getVisibilityProject(
  projectId: string,
  editToken?: string,
): Promise<VisibilityProject> {
  if (projectId.startsWith("local_") || !isSupabaseAdminConfigured()) {
    throw new VisibilityStorageSetupError();
  }

  const supabase = createSupabaseAdminClient();
  const { data: project, error } = await supabase
    .from("visibility_projects")
    .select(`${projectSelect},owner_token_hash`)
    .eq("id", projectId)
    .single<ProjectRow>();

  if (error || !project) throw new VisibilityProjectNotFoundError();
  if (!tokenMatchesHash(editToken, project.owner_token_hash)) {
    throw new VisibilityProjectAccessError(
      "You do not have permission to open this project.",
    );
  }

  return loadVisibilityProjectRelations(project, supabase);
}

/** Internal worker read. The Inngest endpoint is trusted server code. */
export async function getVisibilityProjectForExecution(
  projectId: string,
): Promise<VisibilityProject> {
  if (!isSupabaseAdminConfigured()) throw new VisibilityStorageSetupError();
  const supabase = createSupabaseAdminClient();
  const { data: project, error } = await supabase
    .from("visibility_projects")
    .select(projectSelect)
    .eq("id", projectId)
    .single<ProjectRow>();
  if (error || !project) throw new VisibilityProjectNotFoundError();
  return loadVisibilityProjectRelations(project, supabase);
}

async function loadVisibilityProjectRelations(
  project: ProjectRow,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<VisibilityProject> {
  const [
    cardResult,
    assetsResult,
    topicsResult,
    promptsResult,
    competitorsResult,
  ] = await Promise.all([
    supabase
      .from("visibility_brand_cards")
      .select(cardSelect)
      .eq("project_id", project.id)
      .single<CardRow>(),
    supabase
      .from("visibility_owned_assets")
      .select("url,reason,verification_status")
      .eq("project_id", project.id),
    supabase
      .from("visibility_topics")
      .select(topicSelect)
      .eq("project_id", project.id),
    supabase
      .from("visibility_prompts")
      .select(promptSelect)
      .eq("project_id", project.id),
    supabase
      .from("visibility_competitors")
      .select("name,url")
      .eq("project_id", project.id),
  ]);

  if (cardResult.error || !cardResult.data) {
    throw new Error(
      cardResult.error?.message ?? "AI Visibility card not found.",
    );
  }
  if (
    assetsResult.error ||
    topicsResult.error ||
    promptsResult.error ||
    competitorsResult.error
  ) {
    throw new Error("Unable to load AI Visibility project relations.");
  }

  return fromRows({
    project,
    card: cardResult.data,
    assets: (assetsResult.data ?? []) as AssetRow[],
    topics: (topicsResult.data ?? []) as TopicRow[],
    prompts: (promptsResult.data ?? []) as PromptRow[],
    competitors: (competitorsResult.data ?? []) as Array<{
      name: string;
      url: string | null;
    }>,
  });
}

export async function updateVisibilityProjectApprovals(
  project: VisibilityProject,
  editToken?: string,
): Promise<VisibilityProject> {
  if (project.id.startsWith("local_") || !isSupabaseAdminConfigured()) {
    return { ...project, updatedAt: new Date().toISOString() };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("visibility_projects")
    .select("owner_token_hash")
    .eq("id", project.id)
    .single<{ owner_token_hash: string | null }>();
  if (error || !data || !tokenMatchesHash(editToken, data.owner_token_hash)) {
    throw new VisibilityProjectAccessError(
      "You do not have permission to modify this project.",
    );
  }

  const now = new Date().toISOString();
  const updates = await Promise.all([
    supabase
      .from("visibility_projects")
      .update({ state: project.state, updated_at: now })
      .eq("id", project.id),
    supabase
      .from("visibility_brand_cards")
      .update({
        approval_status: project.brandCard.approvalStatus,
        approved_at: project.brandCard.approvedAt,
      })
      .eq("project_id", project.id),
    supabase
      .from("visibility_topics")
      .update({ included: false })
      .eq("project_id", project.id),
    supabase
      .from("visibility_topics")
      .update({ included: true })
      .eq("project_id", project.id)
      .in(
        "id",
        project.topics
          .filter((topic) => topic.included)
          .map((topic) => topic.id),
      ),
    supabase.from("visibility_prompts").upsert(
      project.prompts.map((prompt) => ({
        id: prompt.id,
        project_id: project.id,
        topic_id: prompt.topicId,
        prompt_text: prompt.text,
        kind: prompt.kind,
        buyer_realism: prompt.buyerRealism,
        market: prompt.market,
        language: prompt.language,
        surfaces: prompt.surfaces,
        why_selected: prompt.whySelected,
        importance_score: prompt.importanceScore,
        competitor_entities: prompt.competitorEntities,
        planned_samples: prompt.plannedSamples,
        included: prompt.included,
        status: prompt.status,
        updated_at: now,
      })),
      { onConflict: "id" },
    ),
  ]);
  const failed = updates.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);

  return { ...project, updatedAt: now, storageStatus: "stored" };
}

export async function updateVisibilityProjectStateForExecution(
  projectId: string,
  state: VisibilityProject["state"],
) {
  const { error } = await createSupabaseAdminClient()
    .from("visibility_projects")
    .update({ state, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error)
    throw new Error(`Unable to update benchmark state: ${error.message}`);
}

export async function updateVisibilityBenchmarkProgress(
  projectId: string,
  progress: VisibilityProject["benchmarkProgress"],
) {
  const { error } = await createSupabaseAdminClient()
    .from("visibility_projects")
    .update({
      benchmark_progress: progress,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  if (error)
    throw new Error(`Unable to update benchmark progress: ${error.message}`);
}

/**
 * Claims a ready cohort with a compare-and-set update. Exactly one concurrent
 * caller can move a project from ready_to_benchmark to benchmark_queued.
 */
export async function queueVisibilityBenchmark(
  project: VisibilityProject,
  progress: NonNullable<VisibilityProject["benchmarkProgress"]>,
  editToken?: string,
): Promise<VisibilityProject> {
  if (!isSupabaseAdminConfigured()) throw new VisibilityStorageSetupError();

  const supabase = createSupabaseAdminClient();
  const { data: ownership, error: ownershipError } = await supabase
    .from("visibility_projects")
    .select("owner_token_hash")
    .eq("id", project.id)
    .single<{ owner_token_hash: string | null }>();
  if (
    ownershipError ||
    !ownership ||
    !tokenMatchesHash(editToken, ownership.owner_token_hash)
  ) {
    throw new VisibilityProjectAccessError(
      "You do not have permission to modify this project.",
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("visibility_projects")
    .update({
      state: "benchmark_queued",
      benchmark_progress: progress,
      updated_at: now,
    })
    .eq("id", project.id)
    .eq("state", "ready_to_benchmark")
    .select(projectSelect)
    .maybeSingle<ProjectRow>();
  if (error) throw new Error("Unable to reserve the benchmark cohort.");
  if (!data) throw new VisibilityBenchmarkConflictError();

  return {
    ...project,
    state: "benchmark_queued",
    benchmarkProgress: progress,
    updatedAt: now,
    storageStatus: "stored",
  };
}

export async function storeVisibilityRunEvidence(input: {
  projectId: string;
  manifest: RunManifest;
  observation: AnswerObservation;
  citations: CitationEvidence[];
  sourceArtifactPaths: Array<string | null>;
  answerExcerpt: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error: runError } = await supabase.from("visibility_runs").upsert(
    {
      id: input.manifest.id,
      project_id: input.projectId,
      prompt_id: input.manifest.promptId,
      surface: input.manifest.surface,
      model_runtime: input.manifest.modelRuntime,
      search_mode: input.manifest.searchMode,
      market: input.manifest.market,
      language: input.manifest.language,
      device: input.manifest.device,
      session_policy: input.manifest.sessionPolicy,
      run_at: input.manifest.runAt,
      repetition: input.manifest.repetition,
      raw_answer_artifact_path: input.manifest.rawAnswerArtifactPath,
      raw_answer_excerpt: input.answerExcerpt,
      source_manifest_artifact_path: input.manifest.sourceManifestArtifactPath,
      parser_version: input.manifest.parserVersion,
      parser_status: input.manifest.parserStatus,
      status: input.manifest.status,
    },
    { onConflict: "id" },
  );
  if (runError)
    throw new Error(`Unable to store run manifest: ${runError.message}`);

  const { error: clearCitationsError } = await supabase
    .from("visibility_citations")
    .delete()
    .eq("run_id", input.manifest.id);
  if (clearCitationsError)
    throw new Error(
      `Unable to refresh run citations: ${clearCitationsError.message}`,
    );

  if (input.citations.length) {
    const { error: citationsError } = await supabase
      .from("visibility_citations")
      .insert(
        input.citations.map((citation, index) => ({
          run_id: input.manifest.id,
          url: citation.url,
          canonical_url: citation.canonicalUrl,
          title: citation.title,
          excerpt: citation.excerpt,
          source_type: citation.sourceType,
          resolved: citation.resolved,
          verification_status:
            citation.verificationStatus ??
            (citation.resolved
              ? citation.supportsClaim
                ? "claim_supported"
                : "citation_resolved"
              : "unresolved"),
          supports_claim: citation.supportsClaim,
          source_artifact_path: input.sourceArtifactPaths[index] ?? null,
        })),
      );
    if (citationsError)
      throw new Error(`Unable to store citations: ${citationsError.message}`);
  }

  const { error: observationError } = await supabase
    .from("visibility_observations")
    .upsert(
      {
        run_id: input.observation.runId,
        answer_observed: input.observation.answerObserved,
        brand_mentioned: input.observation.brandMentioned,
        competitor_mentions: input.observation.competitorMentions,
        recommendation_strength: input.observation.recommendationStrength,
        ranked_position: input.observation.rankedPosition,
        confidence: input.observation.confidence,
        claim_verified: input.observation.claimVerified,
        signal: input.observation.signal,
      },
      { onConflict: "run_id" },
    );
  if (observationError) {
    throw new Error(
      `Unable to store answer observation: ${observationError.message}`,
    );
  }

  const { error: promptError } = await supabase
    .from("visibility_prompts")
    .update({ status: "complete" })
    .eq("id", input.manifest.promptId);
  if (promptError)
    throw new Error(`Unable to update prompt status: ${promptError.message}`);
}

/** Preserve a failed provider attempt so coverage can remain honest on re-read. */
export async function storeVisibilityRunFailure(input: {
  projectId: string;
  manifest: RunManifest;
}) {
  const supabase = createSupabaseAdminClient();
  const { error: runError } = await supabase.from("visibility_runs").upsert(
    {
      id: input.manifest.id,
      project_id: input.projectId,
      prompt_id: input.manifest.promptId,
      surface: input.manifest.surface,
      model_runtime: input.manifest.modelRuntime,
      search_mode: input.manifest.searchMode,
      market: input.manifest.market,
      language: input.manifest.language,
      device: input.manifest.device,
      session_policy: input.manifest.sessionPolicy,
      run_at: input.manifest.runAt,
      repetition: input.manifest.repetition,
      raw_answer_artifact_path: null,
      raw_answer_excerpt: null,
      source_manifest_artifact_path: null,
      parser_version: input.manifest.parserVersion,
      parser_status: input.manifest.parserStatus,
      status: "failed",
    },
    { onConflict: "id" },
  );
  if (runError)
    throw new Error(`Unable to store failed run manifest: ${runError.message}`);

  const { error: promptError } = await supabase
    .from("visibility_prompts")
    .update({ status: "failed" })
    .eq("id", input.manifest.promptId);
  if (promptError)
    throw new Error(
      `Unable to update failed prompt status: ${promptError.message}`,
    );
}

export async function getVisibilityEvidence(
  projectId: string,
  promptTopics: Map<string, string>,
): Promise<VisibilityEvidence> {
  const supabase = createSupabaseAdminClient();
  const { data: runs, error: runsError } = await supabase
    .from("visibility_runs")
    .select(
      "id,prompt_id,surface,market,language,model_runtime,run_at,parser_version,raw_answer_excerpt,raw_answer_artifact_path,source_manifest_artifact_path,status",
    )
    .eq("project_id", projectId)
    .in("status", ["complete", "partial"]);
  if (runsError)
    throw new Error(`Unable to load run evidence: ${runsError.message}`);
  const runIds = (runs ?? []).map((run) => (run as EvidenceRunRow).id);
  if (!runIds.length) return { runs: [] };

  const [observationsResult, citationsResult] = await Promise.all([
    supabase
      .from("visibility_observations")
      .select(
        "run_id,answer_observed,brand_mentioned,competitor_mentions,recommendation_strength,ranked_position,confidence,claim_verified,signal",
      )
      .in("run_id", runIds),
    supabase
      .from("visibility_citations")
      .select(
        "run_id,url,canonical_url,title,excerpt,source_type,resolved,verification_status,supports_claim",
      )
      .in("run_id", runIds),
  ]);
  if (observationsResult.error || citationsResult.error) {
    throw new Error("Unable to load answer observations or citations.");
  }

  const observationsByRun = new Map(
    ((observationsResult.data ?? []) as ObservationRow[]).map((observation) => [
      observation.run_id,
      observation,
    ]),
  );
  const citationsByRun = new Map<string, CitationEvidence[]>();
  for (const citation of (citationsResult.data ?? []) as CitationRow[]) {
    citationsByRun.set(citation.run_id, [
      ...(citationsByRun.get(citation.run_id) ?? []),
      {
        url: citation.url,
        canonicalUrl: citation.canonical_url,
        title: citation.title,
        excerpt: citation.excerpt,
        sourceType: citation.source_type,
        resolved: citation.resolved,
        verificationStatus:
          citation.verification_status ??
          (citation.resolved
            ? citation.supports_claim
              ? "claim_supported"
              : "citation_resolved"
            : "unresolved"),
        supportsClaim: citation.supports_claim,
      },
    ]);
  }

  return {
    runs: (runs ?? []).flatMap((rawRun) => {
      const run = rawRun as EvidenceRunRow;
      const observation = observationsByRun.get(run.id);
      const topicId = promptTopics.get(run.prompt_id);
      if (!observation || !topicId) return [];
      return [
        {
          runId: run.id,
          promptId: run.prompt_id,
          topicId,
          surface: run.surface,
          market: run.market,
          language: run.language,
          modelRuntime: run.model_runtime,
          runAt: run.run_at,
          parserVersion: run.parser_version,
          answerExcerpt: run.raw_answer_excerpt,
          rawAnswerArtifactPath: run.raw_answer_artifact_path,
          sourceManifestArtifactPath: run.source_manifest_artifact_path,
          runStatus: run.status,
          observation: {
            runId: observation.run_id,
            answerObserved: observation.answer_observed,
            brandMentioned: observation.brand_mentioned,
            competitorMentions: observation.competitor_mentions,
            recommendationStrength: observation.recommendation_strength,
            rankedPosition: observation.ranked_position,
            citations: citationsByRun.get(run.id) ?? [],
            confidence: observation.confidence,
            claimVerified: observation.claim_verified,
            signal: observation.signal,
          },
          citations: citationsByRun.get(run.id) ?? [],
        },
      ];
    }),
  };
}

export async function replaceVisibilityActions(
  projectId: string,
  actions: VisibilityProject["actions"],
) {
  const supabase = createSupabaseAdminClient();
  const { error: clearError } = await supabase
    .from("visibility_actions")
    .delete()
    .eq("project_id", projectId)
    .in("status", ["signal_only", "actionable"]);
  if (clearError)
    throw new Error(`Unable to replace Action Queue: ${clearError.message}`);
  if (!actions.length) return;

  const { error: insertError } = await supabase
    .from("visibility_actions")
    .insert(
      actions.map((action) => ({
        project_id: projectId,
        action: action.action,
        why_now: action.whyNow,
        expected_impact: action.expectedImpact,
        owner: action.owner,
        effort: action.effort,
        dependency: action.dependency,
        affected_prompt_ids: action.affectedPromptIds,
        markets: action.markets,
        surfaces: action.surfaces,
        confidence: action.confidence,
        verification_rule: action.verificationRule,
        status: action.status,
      })),
    );
  if (insertError)
    throw new Error(`Unable to save Action Queue: ${insertError.message}`);
}

export async function storeVisibilityCrewAnalysis(
  analysis: VisibilityCrewAnalysis,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("visibility_crew_analyses").upsert(
    {
      analysis_id: analysis.analysisId,
      project_id: analysis.projectId,
      status: analysis.status,
      model_runtime: analysis.modelRuntime,
      prompt_version: analysis.promptVersion,
      analysis,
    },
    { onConflict: "analysis_id" },
  );
  if (error)
    throw new Error(`Unable to store CrewAI analysis: ${error.message}`);
}

export async function getLatestVisibilityCrewAnalysis(
  projectId: string,
): Promise<VisibilityCrewAnalysis | null> {
  const { data, error } = await createSupabaseAdminClient()
    .from("visibility_crew_analyses")
    .select("analysis,created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ analysis: VisibilityCrewAnalysis; created_at: string }>();
  if (error)
    throw new Error(`Unable to load CrewAI analysis: ${error.message}`);
  return data ? { ...data.analysis, createdAt: data.created_at } : null;
}

function toProjectInsert(project: VisibilityProject) {
  return {
    id: project.id,
    brand_url: project.intake.brandUrl,
    brand_name: project.intake.brandName,
    description: project.intake.description,
    primary_category: project.intake.primaryCategory,
    target_customers: project.intake.targetCustomers,
    key_use_cases: project.intake.keyUseCases,
    revenue_goal: project.intake.revenueGoal,
    markets: project.intake.markets,
    languages: project.intake.languages,
    surfaces: project.intake.surfaces,
    runtime_policy: project.intake.runtimePolicy,
    state: project.state,
  };
}

function fromRows(input: {
  project: ProjectRow;
  card: CardRow;
  assets: AssetRow[];
  topics: TopicRow[];
  prompts: PromptRow[];
  competitors: Array<{ name: string; url: string | null }>;
}): VisibilityProject {
  return {
    id: input.project.id,
    ownerMode: "anonymous",
    state: input.project.state,
    intake: {
      brandUrl: input.project.brand_url,
      brandName: input.project.brand_name,
      description: input.project.description,
      primaryCategory: input.project.primary_category,
      targetCustomers: input.project.target_customers,
      keyUseCases: input.project.key_use_cases,
      revenueGoal: input.project.revenue_goal,
      competitors: input.competitors.map((competitor) => ({
        name: competitor.name,
        url: competitor.url ?? "",
      })),
      markets: input.project.markets,
      languages: input.project.languages,
      surfaces: input.project.surfaces,
      runtimePolicy: input.project.runtime_policy,
    },
    brandCard: {
      canonicalName: input.card.canonical_name,
      aliases: input.card.aliases,
      valueProposition: input.card.value_proposition,
      idealCustomerProfile: input.card.ideal_customer_profile,
      products: input.card.products,
      locations: input.card.locations,
      people: input.card.people,
      claims: input.card.claims,
      pricingSignals: input.card.pricing_signals,
      existingNarrative: input.card.existing_narrative,
      ambiguityRisks: input.card.ambiguity_risks,
      initialOwnedAssets: input.assets.map((asset) => ({
        url: asset.url,
        reason: asset.reason,
        verificationStatus: asset.verification_status,
      })),
      health: input.card.health,
      approvalStatus: input.card.approval_status,
      approvedAt: input.card.approved_at,
    },
    topics: input.topics.map((topic) => ({
      id: topic.id,
      statement: topic.statement,
      buyerIntent: topic.buyer_intent,
      funnelStage: topic.funnel_stage,
      commercialValue: topic.commercial_value,
      market: topic.market,
      language: topic.language,
      narrativeRelevance: topic.narrative_relevance,
      competitorNames: topic.competitor_names,
      evidenceSufficiency: topic.evidence_sufficiency,
      evidenceGap: topic.evidence_gap,
      promptCount: topic.prompt_count,
      surfaces: topic.surfaces,
      included: topic.included,
    })),
    prompts: input.prompts.map((prompt) => ({
      id: prompt.id,
      topicId: prompt.topic_id,
      text: prompt.prompt_text,
      kind: prompt.kind,
      buyerRealism: prompt.buyer_realism,
      market: prompt.market,
      language: prompt.language,
      surfaces: prompt.surfaces,
      whySelected: prompt.why_selected,
      importanceScore: prompt.importance_score,
      competitorEntities: prompt.competitor_entities,
      plannedSamples: prompt.planned_samples,
      included: prompt.included,
      status: prompt.status,
    })),
    actions: [],
    benchmarkProgress: input.project.benchmark_progress ?? undefined,
    createdAt: input.project.created_at,
    updatedAt: input.project.updated_at,
    storageStatus: "stored",
  };
}

const projectSelect =
  "id,brand_url,brand_name,description,primary_category,target_customers,key_use_cases,revenue_goal,markets,languages,surfaces,runtime_policy,state,benchmark_progress,created_at,updated_at";
const cardSelect =
  "canonical_name,aliases,value_proposition,ideal_customer_profile,products,locations,people,claims,pricing_signals,existing_narrative,ambiguity_risks,health,approval_status,approved_at";
const topicSelect =
  "id,statement,buyer_intent,funnel_stage,commercial_value,market,language,narrative_relevance,competitor_names,evidence_sufficiency,evidence_gap,prompt_count,surfaces,included";
const promptSelect =
  "id,topic_id,prompt_text,kind,buyer_realism,market,language,surfaces,why_selected,importance_score,competitor_entities,planned_samples,included,status";

export function formatVisibilityStorageError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Unable to store AI Visibility project.";
  if (message.includes("visibility_") && message.includes("schema cache")) {
    return visibilityStorageSetupMessage;
  }
  return "Durable storage could not save this workspace. Retry shortly or contact support.";
}
