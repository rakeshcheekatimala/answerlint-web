import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { canDispatchInngestEvents, inngest } from "@/lib/inngest/client";
import { visibilityBenchmarkRequested } from "@/lib/inngest/functions/visibility-benchmark";
import {
  checkGlobalRateLimit,
  GlobalRateLimitConfigurationError,
} from "@/lib/net/global-rate-limit";
import { getClientKey } from "@/lib/net/rate-limit";
import { configuredVisibilitySurfaces } from "@/lib/visibility/adapters/registry";
import { isVisibilityEnabled } from "@/lib/visibility/feature-flag";
import { MAX_VISIBILITY_RUNS_PER_BENCHMARK } from "@/lib/visibility/constants";
import {
  getVisibilityProjectToken,
  publicVisibilityProject,
  setVisibilityProjectCookie,
} from "@/lib/visibility/capability";
import {
  getVisibilityProject,
  queueVisibilityBenchmark,
  VisibilityBenchmarkConflictError,
  VisibilityProjectAccessError,
  VisibilityProjectNotFoundError,
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
  try {
    const { projectId } = await params;
    const requireShared = process.env.NODE_ENV === "production";
    const rate = await checkGlobalRateLimit(
      getClientKey(request, "visibility:benchmark"),
      { limit: 3, windowMs: 60_000, requireShared },
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many benchmark requests. Please wait before trying again." },
        { status: 429, headers: { "retry-after": String(Math.ceil(rate.retryAfterMs / 1000)) } },
      );
    }

    const token = getVisibilityProjectToken(request, projectId);
    const project = await getVisibilityProject(projectId, token);
    if (!canDispatchInngestEvents()) {
      return NextResponse.json(
        { error: "Configure Inngest before running a durable benchmark." },
        { status: 409 },
      );
    }
    if (
      project.state === "benchmark_queued" &&
      project.benchmarkProgress?.benchmarkId
    ) {
      await inngest.send(
        visibilityBenchmarkRequested.create({
          projectId,
          benchmarkId: project.benchmarkProgress.benchmarkId,
        }),
      );
      const response = NextResponse.json({
        project: publicVisibilityProject(project),
        queued: true,
      });
      return token
        ? setVisibilityProjectCookie(response, projectId, token)
        : response;
    }
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
    // Consume the shared paid-workflow budget only after capability, cohort,
    // provider, and durable-worker validation have all succeeded.
    const daily = await checkGlobalRateLimit("visibility:benchmark:daily", {
      limit: visibilityDailyProviderCallLimit(),
      windowMs: 86_400_000,
      requireShared,
      cost: plannedRuns,
    });
    if (!daily.allowed) {
      return NextResponse.json(
        { error: "The controlled benchmark budget is temporarily exhausted. Please retry later." },
        { status: 429, headers: { "retry-after": String(Math.ceil(daily.retryAfterMs / 1000)) } },
      );
    }

    const benchmarkId = crypto.randomUUID();
    const queued = await queueVisibilityBenchmark(
      project,
      {
        benchmarkId,
        plannedRuns,
        completedRuns: 0,
        failedRuns: 0,
        currentStage: "queued",
        currentPromptId: null,
        message: "Benchmark accepted and waiting for the durable worker.",
        updatedAt: new Date().toISOString(),
      },
      token,
    );
    await inngest.send(
      visibilityBenchmarkRequested.create({ projectId, benchmarkId }),
    );

    const response = NextResponse.json({
      project: publicVisibilityProject(queued),
      queued: true,
    });
    return token ? setVisibilityProjectCookie(response, projectId, token) : response;
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
    if (error instanceof VisibilityProjectNotFoundError) {
      return NextResponse.json(
        { error: "AI Visibility project not found." },
        { status: 404 },
      );
    }
    if (error instanceof VisibilityBenchmarkConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof GlobalRateLimitConfigurationError) {
      return NextResponse.json(
        { error: "Benchmark admission is temporarily unavailable." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Unable to queue benchmark. Retry using the same workspace." },
      { status: 500 },
    );
  }
}

function visibilityDailyProviderCallLimit(
  value = process.env.VISIBILITY_DAILY_PROVIDER_CALL_LIMIT,
) {
  const limit = Number(value ?? 280);
  return Number.isFinite(limit)
    ? Math.min(10_000, Math.max(MAX_VISIBILITY_RUNS_PER_BENCHMARK, Math.trunc(limit)))
    : 280;
}
