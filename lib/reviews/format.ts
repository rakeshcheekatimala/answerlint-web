import type { PublicReview, Review } from "@/lib/reviews/types";

export function formatAuthorName(
  fullName: string,
  showFirstNameOnly: boolean,
): string {
  const normalizedName = fullName.trim().replace(/\s+/g, " ");
  if (!showFirstNameOnly || !normalizedName) return normalizedName;
  return normalizedName.split(/\s/, 1)[0] ?? normalizedName;
}

export function toPublicReview(review: Review): PublicReview | null {
  if (
    review.status !== "approved" ||
    !review.publishingConsent ||
    !review.publishedQuote?.trim() ||
    !review.publishedAt
  ) {
    return null;
  }

  return {
    id: review.id,
    locale: review.locale,
    rating: review.rating,
    quote: review.publishedQuote.trim(),
    featuresTried: review.featuresTried,
    author: {
      displayName: formatAuthorName(
        review.author.fullName,
        review.author.showFirstNameOnly,
      ),
      role: review.author.role,
      company: review.author.company,
      isVerifiedUser: review.author.isVerifiedUser,
    },
    featured: review.featured,
    publishedAt: review.publishedAt,
  };
}
