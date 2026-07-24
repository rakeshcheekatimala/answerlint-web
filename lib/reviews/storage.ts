import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import reviewsEn from "@/content/reviews.en.json";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";
import { toPublicReview } from "@/lib/reviews/format";
import type {
  PublicReview,
  Review,
  ReviewSubmission,
} from "@/lib/reviews/types";
import type { AutomatedModeration } from "@/lib/reviews/moderation";

type ReviewRow = {
  id: string;
  locale: string;
  rating: Review["rating"];
  experience: string;
  published_quote: string | null;
  features_tried: Review["featuresTried"];
  author: Review["author"];
  private_improvement_feedback: string | null;
  publishing_consent: boolean;
  featured: boolean;
  display_order: number | null;
  status: Review["status"];
  moderation: Review["moderation"];
  created_at: string;
  published_at: string | null;
};

export class ReviewStorageUnavailableError extends Error {
  constructor() {
    super("Review submissions are temporarily unavailable. Please try again later.");
    this.name = "ReviewStorageUnavailableError";
  }
}

export async function createPendingReview(
  input: ReviewSubmission,
  automated: AutomatedModeration,
): Promise<{ id: string }> {
  const now = new Date().toISOString();
  if (!isSupabaseAdminConfigured()) {
    if (shouldUseLocalReviewStorage()) {
      return storePendingReviewLocally(input, automated, now);
    }
    throw new ReviewStorageUnavailableError();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      locale: input.locale,
      rating: input.rating,
      experience: input.experience,
      features_tried: input.featuresTried,
      author: {
        ...input.author,
        isVerifiedUser: false,
      },
      private_improvement_feedback: input.privateImprovementFeedback ?? null,
      publishing_consent: input.publishingConsent,
      featured: false,
      status: "pending",
      moderation: { automated, checkedAt: now },
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) throw new ReviewStorageUnavailableError();
  return data;
}

export function shouldUseLocalReviewStorage(
  env: Pick<NodeJS.ProcessEnv, "NODE_ENV"> = process.env,
) {
  return env.NODE_ENV === "development" || env.NODE_ENV === "test";
}

async function storePendingReviewLocally(
  input: ReviewSubmission,
  automated: AutomatedModeration,
  now: string,
) {
  const id = randomUUID();
  const review: Review = {
    id,
    locale: input.locale,
    rating: input.rating,
    experience: input.experience,
    featuresTried: input.featuresTried,
    author: {
      ...input.author,
      isVerifiedUser: false,
    },
    privateImprovementFeedback: input.privateImprovementFeedback,
    publishingConsent: input.publishingConsent,
    featured: false,
    status: "pending",
    moderation: {
      automated,
      checkedAt: now,
    },
    createdAt: now,
  };

  try {
    const filePath =
      process.env.REVIEW_LOCAL_STORAGE_PATH?.trim() ||
      path.join(process.cwd(), ".data", "reviews.ndjson");
    await mkdir(path.dirname(filePath), { recursive: true });
    await appendFile(filePath, `${JSON.stringify(review)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    return { id };
  } catch {
    throw new ReviewStorageUnavailableError();
  }
}

export async function getPublicReviews(locale: string): Promise<PublicReview[]> {
  // Approved reviews are editorial content and must not be frozen into the
  // homepage at build time.
  noStore();
  if (!isSupabaseAdminConfigured()) return getStaticReviews(locale);

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("reviews")
      .select(reviewSelect)
      .eq("locale", locale)
      .eq("status", "approved")
      .eq("publishing_consent", true)
      .not("published_quote", "is", null)
      .order("featured", { ascending: false })
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("published_at", { ascending: false })
      .limit(9)
      .returns<ReviewRow[]>();

    if (error || !data) return getStaticReviews(locale);
    return data.flatMap((row) => {
      const review = toPublicReview(fromRow(row));
      return review ? [review] : [];
    });
  } catch {
    return getStaticReviews(locale);
  }
}

function fromRow(row: ReviewRow): Review {
  return {
    id: row.id,
    locale: row.locale,
    rating: row.rating,
    experience: row.experience,
    publishedQuote: row.published_quote ?? undefined,
    featuresTried: row.features_tried,
    author: row.author,
    privateImprovementFeedback: row.private_improvement_feedback ?? undefined,
    publishingConsent: row.publishing_consent,
    featured: row.featured,
    displayOrder: row.display_order ?? undefined,
    status: row.status,
    moderation: row.moderation,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? undefined,
  };
}

function getStaticReviews(locale: string): PublicReview[] {
  if (locale !== "en") return [];
  return (reviewsEn.items as PublicReview[]).filter(
    (review) => review.locale === locale,
  );
}

const reviewSelect =
  "id,locale,rating,experience,published_quote,features_tried,author,private_improvement_feedback,publishing_consent,featured,display_order,status,moderation,created_at,published_at";
