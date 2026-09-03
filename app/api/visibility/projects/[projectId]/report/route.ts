import { NextResponse } from "next/server";

import { checkGlobalRateLimit } from "@/lib/net/global-rate-limit";
import { getClientKey } from "@/lib/net/rate-limit";
import { buildVisibilityWorkspaceReport } from "@/lib/visibility/reporting";
import { VISIBILITY_PROJECT_TOKEN_HEADER } from "@/lib/visibility/constants";
import {
  getVisibilityEvidence,
  getVisibilityProject,
  VisibilityProjectAccessError,
  VisibilityStorageSetupError,
} from "@/lib/visibility/storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const rate = await checkGlobalRateLimit(
    getClientKey(request, "visibility:report"),
    { limit: 60, windowMs: 60_000 },
  );
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  try {
    const { projectId } = await params;
    const project = await getVisibilityProject(
      projectId,
      request.headers.get(VISIBILITY_PROJECT_TOKEN_HEADER) ?? undefined,
    );
    const evidence = await getVisibilityEvidence(
      project.id,
      new Map(project.prompts.map((prompt) => [prompt.id, prompt.topicId])),
    );
    return NextResponse.json({ report: buildVisibilityWorkspaceReport(project, evidence) });
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
      { error: error instanceof Error ? error.message : "Unable to load visibility report." },
      { status: 500 },
    );
  }
}
