import { eventType } from "inngest";
import { z } from "zod";
import crypto from "node:crypto";

import { inngest } from "@/lib/inngest/client";
import { getVisibilitySurfaceAdapter } from "@/lib/visibility/adapters/registry";
import { storeVisibilityTextArtifact } from "@/lib/visibility/artifacts";
import {
  MAX_VISIBILITY_CITATIONS_PER_RUN,
  MAX_VISIBILITY_RUNS_PER_BENCHMARK,
} from "@/lib/visibility/constants";
import { assessObservation } from "@/lib/visibility/evidence";
import { parseAnswerSignals } from "@/lib/visibility/observation-parser";
import { buildVisibilityWorkspaceReport } from "@/lib/visibility/reporting";
import { verifyCitationSource } from "@/lib/visibility/source-verification";
import {
  getVisibilityProjectForExecution,
  getVisibilityEvidence,
  replaceVisibilityActions,
  storeVisibilityRunEvidence,
  updateVisibilityProjectStateForExecution,
} from "@/lib/visibility/storage";
import type { RunManifest, VisibilityProject } from "@/lib/visibility/types";

export const visibilityBenchmarkRequested = eventType(
  "visibility/benchmark.requested",
  {
    schema: z.object({ projectId: z.string().uuid() }),
  },
);

/**
 * The durable boundary for prompt × surface × market work. Individual provider
 * adapters will run in named steps here, which makes retries and manifests
 * inspectable without giving a route handler a long-running responsibility.
 */
export const runVisibilityBenchmark = inngest.createFunction(
  {
    id: "visibility-benchmark",
    name: "Run AI visibility benchmark",
    retries: 3,
    concurrency: { limit: 2, key: "event.data.projectId", scope: "env" },
    triggers: [{ event: visibilityBenchmarkRequested }],
  },
  async ({ event, step }) => {
    const project = await step.run("load approved project", () =>
      getVisibilityProjectForExecution(event.data.projectId),
    );
    if (project.state !== "benchmark_queued") {
      throw new Error("Visibility project is not queued for benchmarking.");
    }

    await step.run("mark benchmark running", () =>
      updateVisibilityProjectStateForExecution(project.id, "benchmarking"),
    );

    try {
      const plans = project.prompts
        .filter((prompt) => project.topics.some((topic) => topic.id === prompt.topicId && topic.included))
        .flatMap((prompt) =>
          prompt.surfaces
            .filter((surface) => getVisibilitySurfaceAdapter(surface).isConfigured())
            .flatMap((surface) =>
              Array.from({ length: prompt.plannedSamples }, (_, index) => ({
                prompt,
                surface,
                repetition: index + 1,
              })),
            ),
        );

      if (!plans.length) throw new Error("No configured surface is selected for this benchmark.");
      if (plans.length > MAX_VISIBILITY_RUNS_PER_BENCHMARK) {
        throw new Error(
          `This benchmark plans ${plans.length} runs. Keep the approved prompt cohort within the ${MAX_VISIBILITY_RUNS_PER_BENCHMARK}-run budget.`,
        );
      }

      for (const plan of plans) {
        await step.run(
          `execute-${plan.prompt.id}-${plan.surface}-${plan.repetition}`,
          () => executePlan(project, plan),
        );
      }

      const actions = await step.run("build verified Action Queue", async () => {
        const evidence = await getVisibilityEvidence(
          project.id,
          new Map(project.prompts.map((prompt) => [prompt.id, prompt.topicId])),
        );
        return buildVisibilityWorkspaceReport(project, evidence).actions;
      });
      await step.run("store verified Action Queue", () =>
        replaceVisibilityActions(project.id, actions),
      );

      await step.run("mark benchmark complete", () =>
        updateVisibilityProjectStateForExecution(project.id, "completed"),
      );
      return { projectId: project.id, runs: plans.length, status: "completed" };
    } catch (error) {
      await step.run("mark benchmark failed", () =>
        updateVisibilityProjectStateForExecution(project.id, "failed"),
      );
      throw error;
    }
  },
);

async function executePlan(
  project: VisibilityProject,
  plan: { prompt: VisibilityProject["prompts"][number]; surface: RunManifest["surface"]; repetition: number },
) {
  const adapter = getVisibilitySurfaceAdapter(plan.surface);
  const runId = crypto.randomUUID();
  const runAt = new Date().toISOString();
  const draftManifest: RunManifest = {
    id: runId,
    promptId: plan.prompt.id,
    surface: plan.surface,
    modelRuntime: "pending",
    searchMode: project.intake.runtimePolicy.searchMode,
    market: plan.prompt.market,
    language: plan.prompt.language,
    device: project.intake.runtimePolicy.device,
    sessionPolicy: project.intake.runtimePolicy.freshSession ? "fresh" : "reused",
    runAt,
    repetition: plan.repetition,
    rawAnswerArtifactPath: null,
    sourceManifestArtifactPath: null,
    parserVersion: "visibility-parser/2",
    parserStatus: "pending",
    status: "running",
  };
  const result = await adapter.execute({
    projectId: project.id,
    manifest: draftManifest,
    prompt: plan.prompt.text,
  });
  const rawAnswerArtifactPath = await storeVisibilityTextArtifact({
    projectId: project.id,
    runId,
    kind: "raw-answer",
    text: result.rawAnswer,
  });
  const sourceManifestArtifactPath = await storeVisibilityTextArtifact({
    projectId: project.id,
    runId,
    kind: "provider-sources",
    text: JSON.stringify(
      {
        citedUrls: result.citations,
        consultedSources: result.sources,
      },
      null,
      2,
    ),
  });
  const ownedHost = new URL(project.intake.brandUrl).hostname;
  const competitorHosts = project.intake.competitors.flatMap((competitor) => {
    try {
      return competitor.url ? [new URL(competitor.url).hostname] : [];
    } catch {
      return [];
    }
  });
  const verifiedSources = await Promise.all(
    result.citations.slice(0, MAX_VISIBILITY_CITATIONS_PER_RUN).map((citation) => {
      const source = citationSourceContext(
        citation.url,
        project,
        ownedHost,
        competitorHosts,
      );
      return verifyCitationSource({
        ...citation,
        expectedEntities: source.expectedEntities,
        sourceType: source.sourceType,
      });
    }),
  );
  const sourceArtifactPaths = await Promise.all(
    verifiedSources.map((source, index) =>
      source.snapshot
        ? storeVisibilityTextArtifact({
            projectId: project.id,
            runId,
            kind: "source-snapshot",
            sequence: index + 1,
            text: source.snapshot,
          })
        : Promise.resolve(null),
    ),
  );
  const citations = verifiedSources.map((source) => source.citation);
  const parsedSignals = parseAnswerSignals({
    rawAnswer: result.rawAnswer,
    brandName: project.intake.brandName,
    competitors: project.intake.competitors.map((competitor) => competitor.name),
  });
  const observation = assessObservation({
    runId,
    rawAnswer: result.rawAnswer,
    brandMentioned: parsedSignals.brandMentioned,
    competitorMentions: parsedSignals.competitorMentions,
    recommendationStrength: parsedSignals.recommendationStrength,
    rankedPosition: parsedSignals.rankedPosition,
    citations,
    // Aggregation validates repeat confidence after all manifest rows exist.
    completedRepeatCount: 1,
    requiredRepeatCount: project.intake.runtimePolicy.repeatRuns,
  });

  await storeVisibilityRunEvidence({
    projectId: project.id,
    manifest: {
      ...draftManifest,
      modelRuntime: result.modelRuntime,
      rawAnswerArtifactPath,
      sourceManifestArtifactPath,
      parserStatus: "parsed",
      status: "complete",
    },
    observation,
    citations,
    sourceArtifactPaths,
    answerExcerpt: result.rawAnswer.slice(0, 1_600),
  });
}

function citationSourceContext(
  input: string,
  project: VisibilityProject,
  ownedHost: string,
  competitorHosts: string[],
): {
  sourceType: "owned" | "earned" | "competitor" | "unverified";
  expectedEntities: string[];
} {
  try {
    const host = new URL(input).hostname;
    if (host === ownedHost || host.endsWith(`.${ownedHost}`)) {
      return { sourceType: "owned", expectedEntities: [project.intake.brandName] };
    }
    const competitor = project.intake.competitors.find((item) => {
      try {
        const competitorHost = item.url ? new URL(item.url).hostname : "";
        return host === competitorHost || host.endsWith(`.${competitorHost}`);
      } catch {
        return false;
      }
    });
    if (competitor && competitorHosts.length) {
      return { sourceType: "competitor", expectedEntities: [competitor.name] };
    }
    return { sourceType: "earned", expectedEntities: [project.intake.brandName] };
  } catch {
    return { sourceType: "unverified", expectedEntities: [] };
  }
}
