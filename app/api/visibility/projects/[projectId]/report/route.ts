import { NextResponse } from "next/server";

import { checkGlobalRateLimit } from "@/lib/net/global-rate-limit";
import { getClientKey } from "@/lib/net/rate-limit";
import { buildVisibilityWorkspaceReport } from "@/lib/visibility/reporting";
import { isVisibilityEnabled } from "@/lib/visibility/feature-flag";
import {
  getVisibilityProjectToken,
  setVisibilityProjectCookie,
} from "@/lib/visibility/capability";
import {
  getVisibilityEvidence,
  getLatestVisibilityCrewAnalysis,
  getVisibilityProject,
  VisibilityProjectAccessError,
  VisibilityProjectNotFoundError,
  VisibilityStorageSetupError,
} from "@/lib/visibility/storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  if (!isVisibilityEnabled()) {
    return NextResponse.json({ error: "AI Visibility beta is not enabled." }, { status: 404 });
  }
  const rate = await checkGlobalRateLimit(
    getClientKey(request, "visibility:report"),
    { limit: 60, windowMs: 60_000 },
  );
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  try {
    const { projectId } = await params;
    const project = await getVisibilityProject(
      projectId,
      getVisibilityProjectToken(request, projectId),
    );
    const [evidence, crewAnalysis] = await Promise.all([
      getVisibilityEvidence(
        project.id,
        new Map(project.prompts.map((prompt) => [prompt.id, prompt.topicId])),
      ),
      getLatestVisibilityCrewAnalysis(project.id).catch(() => null),
    ]);
    const response = NextResponse.json({
      report: buildVisibilityWorkspaceReport(project, evidence, crewAnalysis),
    });
    const token = getVisibilityProjectToken(request, projectId);
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
    return NextResponse.json(
      { error: "Unable to load visibility report." },
      { status: 500 },
    );
  }
}
