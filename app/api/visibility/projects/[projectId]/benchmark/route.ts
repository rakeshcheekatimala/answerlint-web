import { NextResponse } from "next/server";

import { canDispatchInngestEvents, inngest } from "@/lib/inngest/client";
import { visibilityBenchmarkRequested } from "@/lib/inngest/functions/visibility-benchmark";
import { checkGlobalRateLimit } from "@/lib/net/global-rate-limit";
import { getClientKey } from "@/lib/net/rate-limit";
import { configuredVisibilitySurfaces } from "@/lib/visibility/adapters/registry";
import { isVisibilityEnabled } from "@/lib/visibility/feature-flag";
import {
  MAX_VISIBILITY_RUNS_PER_BENCHMARK,
  VISIBILITY_PROJECT_TOKEN_HEADER,
} from "@/lib/visibility/constants";
import {
  getVisibilityProject,
  updateVisibilityBenchmarkProgress,
  updateVisibilityProjectApprovals,
  VisibilityProjectAccessError,
  VisibilityStorageSetupError,
} from "@/lib/visibility/storage";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  if (!isVisibilityEnabled()) {
    return NextResponse.json({ error: "AI Visibility beta is not enabled." }, { status: 404 });
  }
  const rate = await checkGlobalRateLimit(
    getClientKey(request, "visibility:benchmark"),
    { limit: 3, windowMs: 60_000 },
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many benchmark requests. Please wait before trying again." },
      { status: 429, headers: { "retry-after": String(Math.ceil(rate.retryAfterMs / 1000)) } },
    );
  }

  try {
    const { projectId } = await params;
    const token = request.headers.get(VISIBILITY_PROJECT_TOKEN_HEADER) ?? undefined;
    const project = await getVisibilityProject(projectId, token);
    if (project.state !== "ready_to_benchmark") {
      return NextResponse.json(
        { error: "Approve the Brand Intelligence Card and Topic Map before benchmarking." },
        { status: 409 },
      );
    }

    const configuredSurfaces = configuredVisibilitySurfaces();
    const selectedConfiguredSurfaces = project.intake.surfaces.filter((surface) =>
      configuredSurfaces.includes(surface),
    );
    if (!selectedConfiguredSurfaces.length) {
      return NextResponse.json(
        {
          error:
            "None of this project's selected surfaces are configured. Connect a supported provider before running a controlled benchmark; AnswerLint will not scrape logged-in consumer products.",
        },
        { status: 409 },
      );
    }
    const includedTopicIds = new Set(
      project.topics.filter((topic) => topic.included).map((topic) => topic.id),
    );
    const plannedRuns = project.prompts
      .filter((prompt) => prompt.included && includedTopicIds.has(prompt.topicId))
      .reduce(
        (count, prompt) =>
          count +
          prompt.surfaces.filter((surface) => selectedConfiguredSurfaces.includes(surface)).length *
            prompt.plannedSamples,
        0,
      );
    if (plannedRuns === 0) {
      return NextResponse.json(
        { error: "Keep at least one prompt with a configured surface in the benchmark cohort." },
        { status: 409 },
      );
    }
    if (plannedRuns > MAX_VISIBILITY_RUNS_PER_BENCHMARK) {
      return NextResponse.json(
        {
          error: `This run would use ${plannedRuns} provider calls. Keep the approved cohort within the ${MAX_VISIBILITY_RUNS_PER_BENCHMARK}-run budget.`,
        },
        { status: 409 },
      );
    }
    if (!canDispatchInngestEvents()) {
      return NextResponse.json(
        { error: "Configure Inngest before running a durable benchmark." },
        { status: 409 },
      );
    }

    const queued = await updateVisibilityProjectApprovals(
      {
        ...project,
        state: "benchmark_queued",
        benchmarkProgress: {
          plannedRuns,
          completedRuns: 0,
          failedRuns: 0,
          currentStage: "queued",
          currentPromptId: null,
          message: "Benchmark accepted and waiting for the durable worker.",
          updatedAt: new Date().toISOString(),
        },
      },
      token,
    );
    await updateVisibilityBenchmarkProgress(project.id, queued.benchmarkProgress);
    await inngest.send(visibilityBenchmarkRequested.create({ projectId }));

    return NextResponse.json({ project: queued, queued: true });
  } catch (error) {
    if (error instanceof VisibilityProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof VisibilityStorageSetupError) {
      return NextResponse.json(
        { error: error.message, code: "visibility_storage_not_configured" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to queue benchmark." },
      { status: 500 },
    );
  }
}
