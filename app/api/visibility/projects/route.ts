import { NextResponse } from "next/server";

import { checkGlobalRateLimit } from "@/lib/net/global-rate-limit";
import { getClientKey } from "@/lib/net/rate-limit";
import { createVisibilityProjectDraft } from "@/lib/visibility/planner";
import { isVisibilityEnabled } from "@/lib/visibility/feature-flag";
import { storeVisibilityProjectBestEffort } from "@/lib/visibility/storage";
import {
  publicVisibilityProject,
  setVisibilityProjectCookie,
} from "@/lib/visibility/capability";
import {
  InvalidVisibilityInputError,
  parseVisibilityIntake,
} from "@/lib/visibility/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isVisibilityEnabled()) {
    return NextResponse.json({ error: "AI Visibility beta is not enabled." }, { status: 404 });
  }
  try {
    const rate = await checkGlobalRateLimit(
      getClientKey(request, "visibility:project-create"),
      {
        limit: 6,
        windowMs: 60_000,
      },
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many setup attempts. Please wait a moment and try again." },
        { status: 429, headers: { "retry-after": String(Math.ceil(rate.retryAfterMs / 1000)) } },
      );
    }
    const intake = parseVisibilityIntake(await request.json());
    const project = await storeVisibilityProjectBestEffort(
      createVisibilityProjectDraft(intake),
    );
    const response = NextResponse.json(
      { project: publicVisibilityProject(project) },
      { status: 201 },
    );
    return project.storageStatus === "stored" && project.editToken
      ? setVisibilityProjectCookie(response, project.id, project.editToken)
      : response;
  } catch (error) {
    if (error instanceof InvalidVisibilityInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Unable to create visibility project." },
      { status: 500 },
    );
  }
}
