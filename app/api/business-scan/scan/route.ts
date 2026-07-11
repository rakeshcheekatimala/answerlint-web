import { NextResponse } from "next/server";

import { isBusinessScanEnabled } from "@/lib/business-scan/feature-flag";
import { runBusinessAwareScan } from "@/lib/business-scan/scan";
import {
  getBusinessScanProject,
  ProjectAccessError,
  updateBusinessScanProjectBestEffort,
} from "@/lib/business-scan/storage";
import {
  InvalidProjectError,
  sanitizeProjectPayload,
} from "@/lib/business-scan/validation";
import { checkRateLimit, getClientKey } from "@/lib/net/rate-limit";

export const runtime = "nodejs";

const PROJECT_TOKEN_HEADER = "x-citeops-project-token";

export async function POST(request: Request) {
  if (!isBusinessScanEnabled()) {
    return NextResponse.json(
      { error: "Business-Aware Scan is not enabled." },
      { status: 404 },
    );
  }

  const rate = checkRateLimit(getClientKey(request, "business-scan:scan"), {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many scans. Please wait a moment and try again." },
      { status: 429, headers: { "retry-after": retryAfterSeconds(rate.retryAfterMs) } },
    );
  }

  const editToken = request.headers.get(PROJECT_TOKEN_HEADER) ?? undefined;

  try {
    const body = (await request.json()) as {
      project?: unknown;
      projectId?: string;
    };

    const project = body.project
      ? sanitizeProjectPayload(body.project)
      : await loadProject(body.projectId, editToken);

    const dashboard = await runBusinessAwareScan(project);
    const storedProject = await updateBusinessScanProjectBestEffort(
      dashboard.project,
      editToken,
    );

    return NextResponse.json({
      dashboard: {
        ...dashboard,
        project: storedProject,
        run: storedProject.scanHistory[0] ?? dashboard.run,
      },
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof InvalidProjectError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to run Business-Aware Scan.",
      },
      { status: 500 },
    );
  }
}

async function loadProject(projectId: string | undefined, editToken?: string) {
  if (!projectId) {
    throw new InvalidProjectError("A project is required.");
  }
  return getBusinessScanProject(projectId, editToken);
}

function retryAfterSeconds(ms: number) {
  return String(Math.ceil(ms / 1000));
}
