import { NextResponse } from "next/server";

import { isBusinessScanEnabled } from "@/lib/business-scan/feature-flag";
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

const PROJECT_TOKEN_HEADER = "x-answerlint-project-token";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  if (!isBusinessScanEnabled()) {
    return NextResponse.json(
      { error: "Business-Aware Scan is not enabled." },
      { status: 404 },
    );
  }

  const rate = checkRateLimit(getClientKey(request, "business-scan:project-get"), {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  try {
    const { projectId } = await params;
    const editToken = request.headers.get(PROJECT_TOKEN_HEADER) ?? undefined;
    const project = await getBusinessScanProject(projectId, editToken);
    return NextResponse.json({ project });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Business-Aware Scan project not found.",
      },
      { status: 404 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  if (!isBusinessScanEnabled()) {
    return NextResponse.json(
      { error: "Business-Aware Scan is not enabled." },
      { status: 404 },
    );
  }

  const rate = checkRateLimit(getClientKey(request, "business-scan:project-patch"), {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  try {
    const { projectId } = await params;
    const editToken = request.headers.get(PROJECT_TOKEN_HEADER) ?? undefined;
    const body = (await request.json()) as { project?: unknown };
    if (!body.project) {
      return NextResponse.json(
        { error: "A matching project payload is required." },
        { status: 400 },
      );
    }

    const sanitized = sanitizeProjectPayload(body.project);
    if (sanitized.id !== projectId) {
      return NextResponse.json(
        { error: "A matching project payload is required." },
        { status: 400 },
      );
    }

    const project = await updateBusinessScanProjectBestEffort(sanitized, editToken);
    return NextResponse.json({ project });
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
            : "Unable to update Business-Aware Scan project.",
      },
      { status: 500 },
    );
  }
}
