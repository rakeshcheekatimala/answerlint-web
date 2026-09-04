import { NextResponse } from "next/server";

import { checkGlobalRateLimit } from "@/lib/net/global-rate-limit";
import { getClientKey } from "@/lib/net/rate-limit";
import { applyProjectApprovals } from "@/lib/visibility/lifecycle";
import { isVisibilityEnabled } from "@/lib/visibility/feature-flag";
import { VISIBILITY_PROJECT_TOKEN_HEADER } from "@/lib/visibility/constants";
import {
  getVisibilityProject,
  updateVisibilityProjectApprovals,
  VisibilityProjectAccessError,
  VisibilityStorageSetupError,
} from "@/lib/visibility/storage";
import { visibilityApprovalSchema } from "@/lib/visibility/schema";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  if (!isVisibilityEnabled()) {
    return NextResponse.json({ error: "AI Visibility beta is not enabled." }, { status: 404 });
  }
  const rate = await checkGlobalRateLimit(
    getClientKey(request, "visibility:project-get"),
    { limit: 60, windowMs: 60_000 },
  );
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  try {
    const { projectId } = await params;
    const project = await getVisibilityProject(
      projectId,
      request.headers.get(VISIBILITY_PROJECT_TOKEN_HEADER) ?? undefined,
    );
    return NextResponse.json({ project });
  } catch (error) {
    return projectErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  if (!isVisibilityEnabled()) {
    return NextResponse.json({ error: "AI Visibility beta is not enabled." }, { status: 404 });
  }
  const rate = await checkGlobalRateLimit(
    getClientKey(request, "visibility:project-patch"),
    { limit: 30, windowMs: 60_000 },
  );
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  try {
    const { projectId } = await params;
    const parsed = visibilityApprovalSchema.safeParse(await request.json());
    if (!parsed.success || (!parsed.data.brandCard && !parsed.data.topicIds && !parsed.data.prompts)) {
      return NextResponse.json({ error: "Submit a brand-card or benchmark-cohort update." }, { status: 400 });
    }
    const token = request.headers.get(VISIBILITY_PROJECT_TOKEN_HEADER) ?? undefined;
    const existing = await getVisibilityProject(projectId, token);
    if (
      parsed.data.topicIds?.some(
        (topicId) => !existing.topics.some((topic) => topic.id === topicId),
      )
    ) {
      return NextResponse.json(
        { error: "Topic approval can only include this project's generated topics." },
        { status: 400 },
      );
    }
    if (parsed.data.prompts) {
      if (!["awaiting_brand_approval", "awaiting_topic_approval"].includes(existing.state)) {
        return NextResponse.json(
          { error: "The prompt cohort is locked once it is approved." },
          { status: 409 },
        );
      }
      const existingPromptIds = new Set(existing.prompts.map((prompt) => prompt.id));
      if (parsed.data.prompts.some((prompt) => !existingPromptIds.has(prompt.id))) {
        return NextResponse.json(
          { error: "Prompt updates can only reference this project's generated prompts." },
          { status: 400 },
        );
      }
      if (!parsed.data.prompts.some((prompt) => prompt.included)) {
        return NextResponse.json(
          { error: "Keep at least one clear prompt in the benchmark cohort." },
          { status: 400 },
        );
      }
    }
    const project = await updateVisibilityProjectApprovals(
      applyProjectApprovals(existing, parsed.data),
      token,
    );
    return NextResponse.json({ project });
  } catch (error) {
    return projectErrorResponse(error);
  }
}

function projectErrorResponse(error: unknown) {
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
    { error: error instanceof Error ? error.message : "AI Visibility project not found." },
    { status: 404 },
  );
}
