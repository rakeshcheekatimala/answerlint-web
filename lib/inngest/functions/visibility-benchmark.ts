import { eventType } from "inngest";
import { z } from "zod";
import crypto from "node:crypto";

import { inngest } from "@/lib/inngest/client";
import { getVisibilitySurfaceAdapter } from "@/lib/visibility/adapters/registry";
import { storeVisibilityTextArtifact } from "@/lib/visibility/artifacts";
import {
  MAX_VISIBILITY_CITATIONS_PER_RUN,
  MAX_VISIBILITY_RUNS_PER_BENCHMARK,
  MAX_VISIBILITY_SOURCE_FETCHES_PER_BENCHMARK,
} from "@/lib/visibility/constants";
import { assessObservation } from "@/lib/visibility/evidence";
import { parseAnswerSignals } from "@/lib/visibility/observation-parser";
import {
  buildVisibilityWorkspaceReport,
  mergeVisibilityActions,
} from "@/lib/visibility/reporting";
import { invokeVisibilityCrew } from "@/lib/visibility/crew/client";
import { verifyCitationSource } from "@/lib/visibility/source-verification";
import { isVisibilityEnabled } from "@/lib/visibility/feature-flag";
import {
  getVisibilityProjectForExecution,
  getVisibilityEvidence,
  replaceVisibilityActions,
  storeVisibilityRunEvidence,
  storeVisibilityRunFailure,
  storeVisibilityCrewAnalysis,
  updateVisibilityBenchmarkProgress,
  updateVisibilityProjectStateForExecution,
} from "@/lib/visibility/storage";
import type {
  RunManifest,
  VisibilityBenchmarkProgress,
  VisibilityProject,
} from "@/lib/visibility/types";

export const visibilityBenchmarkRequested = eventType(
  "visibility/benchmark.requested",
  {
    schema: z.object({
      projectId: z.string().uuid(),
      benchmarkId: z.string().uuid(),
    }),
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
    idempotency: "event.data.benchmarkId",
    concurrency: { limit: 1, key: "event.data.projectId", scope: "env" },
    triggers: [{ event: visibilityBenchmarkRequested }],
  },
  async ({ event, step }) => {
    if (!isVisibilityEnabled()) {
      return { projectId: event.data.projectId, runs: 0, status: "blocked" };
    }
    const project = await step.run("load approved project", () =>
      getVisibilityProjectForExecution(event.data.projectId),
    );
    if (project.state !== "benchmark_queued") {
      throw new Error("Visibility project is not queued for benchmarking.");
    }
    if (project.benchmarkProgress?.benchmarkId !== event.data.benchmarkId) {
      throw new Error("The queued benchmark cohort does not match this event.");
    }

    await step.run("mark benchmark running", () =>
      updateVisibilityProjectStateForExecution(project.id, "benchmarking"),
    );

    let progressSnapshot: VisibilityBenchmarkProgress = project.benchmarkProgress ?? {
      benchmarkId: event.data.benchmarkId,
      plannedRuns: 0,
      completedRuns: 0,
      failedRuns: 0,
      currentStage: "queued",
      currentPromptId: null,
      message: "Benchmark accepted by the worker.",
      updatedAt: new Date().toISOString(),
    };

    try {
      // Inngest replays the function body between durable steps. Read provider
      // configuration inside a step so the check runs in the same server
      // context as the provider work, rather than during replay planning.
      const configuredSurfaces = await step.run(
        "validate configured surfaces",
        () => {
          const configured = project.intake.surfaces.filter((surface) =>
            getVisibilitySurfaceAdapter(surface).isConfigured(),
          );
          if (!configured.length) {
            throw new Error(
              "No configured surface is selected for this benchmark.",
            );
          }
          return configured;
        },
      );
      const configuredSurfaceSet = new Set(configuredSurfaces);
      const plans = project.prompts
        .filter(
          (prompt) =>
            prompt.included &&
            project.topics.some(
              (topic) => topic.id === prompt.topicId && topic.included,
            ),
        )
        .flatMap((prompt) =>
          prompt.surfaces
            .filter((surface) => configuredSurfaceSet.has(surface))
            .flatMap((surface) =>
              Array.from({ length: prompt.plannedSamples }, (_, index) => ({
                prompt,
                surface,
                repetition: index + 1,
              })),
            ),
        );

      if (!plans.length)
        throw new Error(
          "No configured surface is selected for this benchmark.",
        );
      if (plans.length > MAX_VISIBILITY_RUNS_PER_BENCHMARK) {
        throw new Error(
          `This benchmark plans ${plans.length} runs. Keep the approved prompt cohort within the ${MAX_VISIBILITY_RUNS_PER_BENCHMARK}-run budget.`,
        );
      }

      progressSnapshot = {
        benchmarkId: event.data.benchmarkId,
        plannedRuns: plans.length,
        completedRuns: 0,
        failedRuns: 0,
        currentStage: "collecting",
        currentPromptId: plans[0]?.prompt.id ?? null,
        message: `Collecting ${plans.length} controlled answer runs.`,
        updatedAt: new Date().toISOString(),
      };
      await step.run("record benchmark plan", () =>
        updateVisibilityBenchmarkProgress(project.id, progressSnapshot),
      );

      let remainingSourceFetches = MAX_VISIBILITY_SOURCE_FETCHES_PER_BENCHMARK;
      const outcomes: Array<{
        status: "complete" | "partial" | "failed";
        sourceFetches: number;
      }> = [];
      for (const plan of plans) {
        const outcome = await step.run(
          `execute-${plan.prompt.id}-${plan.surface}-${plan.repetition}`,
          () =>
            executePlan(
              project,
              event.data.benchmarkId,
              plan,
              remainingSourceFetches,
            ),
        );
        outcomes.push(outcome);
        remainingSourceFetches -= outcome.sourceFetches;
        progressSnapshot = {
          benchmarkId: event.data.benchmarkId,
          plannedRuns: plans.length,
          completedRuns: outcomes.filter((item) => item.status !== "failed")
            .length,
          failedRuns: outcomes.filter((item) => item.status === "failed")
            .length,
          currentStage: "verifying",
          currentPromptId: plan.prompt.id,
          message: `${outcomes.length} of ${plans.length} runs processed; source evidence is being verified.`,
          updatedAt: new Date().toISOString(),
        };
        await step.run(
          `progress-${plan.prompt.id}-${plan.surface}-${plan.repetition}`,
          () => updateVisibilityBenchmarkProgress(project.id, progressSnapshot),
        );
      }

      progressSnapshot = {
        benchmarkId: event.data.benchmarkId,
        plannedRuns: plans.length,
        completedRuns: outcomes.filter((item) => item.status !== "failed")
          .length,
        failedRuns: outcomes.filter((item) => item.status === "failed").length,
        currentStage: "interpreting",
        currentPromptId: null,
        message:
          "Evidence collection is complete. Building the brand-voice decision brief.",
        updatedAt: new Date().toISOString(),
      };
      await step.run("mark interpretation running", () =>
        updateVisibilityBenchmarkProgress(project.id, progressSnapshot),
      );

      const evidence = await step.run("load verified evidence", () =>
        getVisibilityEvidence(
          project.id,
          new Map(project.prompts.map((prompt) => [prompt.id, prompt.topicId])),
        ),
      );
      const crewAnalysis = await step.run(
        "interpret evidence with CrewAI",
        () => invokeVisibilityCrew(project, evidence),
      );
      if (crewAnalysis) {
        await step.run("store CrewAI decision brief", () =>
          storeVisibilityCrewAnalysis(crewAnalysis),
        );
      }

      const actions = await step.run(
        "build verified Action Queue",
        async () => {
          const deterministic = buildVisibilityWorkspaceReport(
            project,
            evidence,
          ).actions;
          return mergeVisibilityActions(deterministic, crewAnalysis);
        },
      );
      await step.run("store verified Action Queue", () =>
        replaceVisibilityActions(project.id, actions),
      );

      await step.run("mark benchmark complete", () =>
        updateVisibilityProjectStateForExecution(project.id, "completed"),
      );
      progressSnapshot = {
        ...progressSnapshot,
        currentStage: "complete",
        currentPromptId: null,
        message: crewAnalysis
          ? "Evidence and the CrewAI decision brief are ready."
          : "Evidence is ready; deterministic safeguards were used without an agentic brief.",
        updatedAt: new Date().toISOString(),
      };
      await step.run("record benchmark completion", () =>
        updateVisibilityBenchmarkProgress(project.id, progressSnapshot),
      );
      return {
        projectId: project.id,
        runs: plans.length,
        status: outcomes.some((outcome) => outcome.status !== "complete")
          ? "partial"
          : "completed",
      };
    } catch (error) {
      await step.run("record benchmark failure", () =>
        updateVisibilityBenchmarkProgress(project.id, {
          ...progressSnapshot,
          currentStage: "failed",
          currentPromptId: null,
          message: safeBenchmarkFailureMessage(error),
          updatedAt: new Date().toISOString(),
        }),
      );
      await step.run("mark benchmark failed", () =>
        updateVisibilityProjectStateForExecution(project.id, "failed"),
      );
      throw error;
    }
  },
);

function safeBenchmarkFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("No configured surface")) {
    return "The selected provider is not configured. Verify the provider key and model in the worker environment, then redeploy.";
  }
  if (message.includes("OpenAI visibility request failed")) {
    return "The provider rejected a request. Open the Inngest run for the technical error; completed evidence remains preserved.";
  }
  if (message.includes("Visibility Crew")) {
    return "Evidence collection finished, but the decision brief failed. Inspect the CrewAI service health and signed-request configuration.";
  }
  return "The benchmark stopped before completion. Open the Inngest run for diagnosis; completed evidence remains preserved.";
}

async function executePlan(
  project: VisibilityProject,
  benchmarkId: string,
  plan: {
    prompt: VisibilityProject["prompts"][number];
    surface: RunManifest["surface"];
    repetition: number;
  },
  remainingSourceFetches: number,
) {
  const adapter = getVisibilitySurfaceAdapter(plan.surface);
  const runId = deterministicRunId(
    project.id,
    benchmarkId,
    plan.prompt.id,
    plan.surface,
    plan.repetition,
  );
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
    sessionPolicy: project.intake.runtimePolicy.freshSession
      ? "fresh"
      : "reused",
    runAt,
    repetition: plan.repetition,
    rawAnswerArtifactPath: null,
    sourceManifestArtifactPath: null,
    parserVersion: "visibility-parser/2",
    parserStatus: "pending",
    status: "running",
  };
  try {
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
    const verificationLimit = Math.max(
      0,
      Math.min(MAX_VISIBILITY_CITATIONS_PER_RUN, remainingSourceFetches),
    );
    const citationsToVerify = result.citations.slice(0, verificationLimit);
    const isPartial = citationsToVerify.length < result.citations.length;
    const verifiedSources = await Promise.all(
      citationsToVerify.map((citation) => {
        const source = citationSourceContext(
          citation.url,
          project,
          ownedHost,
          competitorHosts,
        );
        return verifyCitationSource({
          ...citation,
          expectedEntities: source.expectedEntities,
          expectedClaims: project.brandCard.claims,
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
      competitors: project.intake.competitors.map(
        (competitor) => competitor.name,
      ),
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
        status: isPartial ? "partial" : "complete",
      },
      observation,
      citations,
      sourceArtifactPaths,
      answerExcerpt: result.rawAnswer.slice(0, 1_600),
    });
    return {
      status: isPartial ? ("partial" as const) : ("complete" as const),
      sourceFetches: citationsToVerify.length,
    };
  } catch {
    await storeVisibilityRunFailure({
      projectId: project.id,
      manifest: { ...draftManifest, parserStatus: "failed", status: "failed" },
    });
    return { status: "failed" as const, sourceFetches: 0 };
  }
}

function deterministicRunId(
  projectId: string,
  benchmarkId: string,
  promptId: string,
  surface: RunManifest["surface"],
  repetition: number,
) {
  const digest = crypto
    .createHash("sha256")
    .update(`${projectId}:${benchmarkId}:${promptId}:${surface}:${repetition}`)
    .digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`;
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
      return {
        sourceType: "owned",
        expectedEntities: [project.intake.brandName],
      };
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
    return {
      sourceType: "earned",
      expectedEntities: [project.intake.brandName],
    };
  } catch {
    return { sourceType: "unverified", expectedEntities: [] };
  }
}
