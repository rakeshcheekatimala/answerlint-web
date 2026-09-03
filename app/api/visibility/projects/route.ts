import { NextResponse } from "next/server";

import { checkGlobalRateLimit } from "@/lib/net/global-rate-limit";
import { getClientKey } from "@/lib/net/rate-limit";
import { createVisibilityProjectDraft } from "@/lib/visibility/planner";
import { storeVisibilityProjectBestEffort } from "@/lib/visibility/storage";
import {
  InvalidVisibilityInputError,
  parseVisibilityIntake,
} from "@/lib/visibility/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rate = await checkGlobalRateLimit(
    getClientKey(request, "visibility:project-create"),
    { limit: 6, windowMs: 60_000 },
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many setup attempts. Please wait a moment and try again." },
      { status: 429, headers: { "retry-after": String(Math.ceil(rate.retryAfterMs / 1000)) } },
    );
  }

  try {
    const intake = parseVisibilityIntake(await request.json());
    const project = await storeVisibilityProjectBestEffort(
      createVisibilityProjectDraft(intake),
    );
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidVisibilityInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create visibility project." },
      { status: 500 },
    );
  }
}
