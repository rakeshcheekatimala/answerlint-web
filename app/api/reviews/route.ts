import { NextResponse } from "next/server";

import { checkRateLimit, getClientKey } from "@/lib/net/rate-limit";
import { screenReview } from "@/lib/reviews/moderation";
import {
  createPendingReview,
  ReviewStorageUnavailableError,
} from "@/lib/reviews/storage";
import {
  parseReviewSubmission,
  ReviewValidationError,
} from "@/lib/reviews/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rate = checkRateLimit(getClientKey(request, "reviews:submit"), {
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many review submissions. Please try again later." },
      {
        status: 429,
        headers: { "retry-after": String(Math.ceil(rate.retryAfterMs / 1000)) },
      },
    );
  }

  try {
    const input = parseReviewSubmission(await request.json());
    // Honeypot fields are silently accepted so automated senders cannot tune
    // around the spam defense, but nothing is persisted.
    if (input.website) {
      return NextResponse.json({ submitted: true }, { status: 202 });
    }

    const moderation = screenReview(input);
    const review = await createPendingReview(input, moderation);
    return NextResponse.json(
      { submitted: true, reviewId: review.id },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ReviewValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ReviewStorageUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: "Unable to submit the review. Please try again." },
      { status: 400 },
    );
  }
}
