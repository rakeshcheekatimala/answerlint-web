import { describe, expect, it } from "vitest";

import { formatAuthorName, toPublicReview } from "@/lib/reviews/format";
import { screenReview } from "@/lib/reviews/moderation";
import type { Review, ReviewSubmission } from "@/lib/reviews/types";
import {
  parseReviewSubmission,
  ReviewValidationError,
} from "@/lib/reviews/validation";

const submission: ReviewSubmission = {
  locale: "en",
  rating: 4,
  experience:
    "The competitor audit made our content review clearer before the release.",
  featuresTried: ["competitor_comparison", "aeo_geo_scoring"],
  author: {
    fullName: "Priya Rao",
    showFirstNameOnly: true,
    email: "priya@example.com",
  },
  publishingConsent: true,
};

describe("review validation", () => {
  it("normalizes a valid submission", () => {
    expect(
      parseReviewSubmission({
        ...submission,
        author: { ...submission.author, fullName: "  Priya   Rao  " },
      }),
    ).toMatchObject({
      author: { fullName: "Priya Rao", email: "priya@example.com" },
      featuresTried: ["competitor_comparison", "aeo_geo_scoring"],
    });
  });

  it("rejects unknown feature identifiers", () => {
    expect(() =>
      parseReviewSubmission({
        ...submission,
        featuresTried: ["competitor_comparision"],
      }),
    ).toThrow(ReviewValidationError);
  });

  it("requires publishing consent", () => {
    expect(() =>
      parseReviewSubmission({ ...submission, publishingConsent: false }),
    ).toThrow("Publishing consent is required.");
  });
});

describe("review moderation", () => {
  it("keeps constructive criticism separate from safety", () => {
    expect(
      screenReview({
        ...submission,
        rating: 2,
        experience:
          "The competitor audit was confusing and the report needs work before our team can use it.",
      }),
    ).toMatchObject({
      safetyCategory: "safe",
      qualityCategory: "critical",
    });
  });

  it("flags links for manual safety review", () => {
    expect(
      screenReview({
        ...submission,
        experience:
          "The AnswerLint audit was useful. See https://example.com for additional context on our test.",
      }).safetyCategory,
    ).toBe("suspicious_links");
  });
});

describe("public review DTO", () => {
  const approvedReview: Review = {
    id: "review-1",
    locale: "en",
    rating: 5,
    experience: submission.experience,
    publishedQuote: "The competitor audit made our content review clearer.",
    featuresTried: submission.featuresTried,
    author: {
      ...submission.author,
      email: "private@example.com",
      isVerifiedUser: true,
    },
    privateImprovementFeedback: "Private feedback",
    publishingConsent: true,
    featured: true,
    status: "approved",
    moderation: {
      automated: {
        safetyCategory: "safe",
        qualityCategory: "constructive",
        confidence: 0.8,
        reasons: [],
      },
    },
    createdAt: "2026-07-25T00:00:00.000Z",
    publishedAt: "2026-07-25T01:00:00.000Z",
  };

  it("exposes only intentionally public fields", () => {
    const result = toPublicReview(approvedReview);
    expect(result?.author).toEqual({
      displayName: "Priya",
      isVerifiedUser: true,
    });
    expect(result).not.toHaveProperty("privateImprovementFeedback");
    expect(result).not.toHaveProperty("moderation");
    expect(result?.author).not.toHaveProperty("email");
  });

  it("refuses reviews that are not approved and publishable", () => {
    expect(toPublicReview({ ...approvedReview, status: "pending" })).toBeNull();
  });
});

describe("formatAuthorName", () => {
  it("normalizes whitespace and respects the privacy setting", () => {
    expect(formatAuthorName("  Priya \t Rao ", true)).toBe("Priya");
    expect(formatAuthorName("  Priya \t Rao ", false)).toBe("Priya Rao");
  });
});
