import {
  answerLintFeatures,
  type AnswerLintFeature,
  type ReviewSubmission,
} from "@/lib/reviews/types";

const featureSet = new Set<string>(answerLintFeatures);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ReviewValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewValidationError";
  }
}

export function parseReviewSubmission(value: unknown): ReviewSubmission {
  if (!value || typeof value !== "object") {
    throw new ReviewValidationError("Invalid review submission.");
  }
  const body = value as Record<string, unknown>;
  const author =
    body.author && typeof body.author === "object"
      ? (body.author as Record<string, unknown>)
      : {};
  const features = Array.isArray(body.featuresTried)
    ? body.featuresTried.filter(
        (feature): feature is AnswerLintFeature =>
          typeof feature === "string" && featureSet.has(feature),
      )
    : [];

  const rating = Number(body.rating);
  const experience = cleanText(body.experience);
  const fullName = cleanText(author.fullName);
  const email = cleanText(author.email).toLowerCase();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ReviewValidationError("Choose an experience rating.");
  }
  if (features.length === 0 || features.length !== (body.featuresTried as unknown[])?.length) {
    throw new ReviewValidationError("Choose at least one valid feature.");
  }
  if (experience.length < 40 || experience.length > 1200) {
    throw new ReviewValidationError("Your experience must be between 40 and 1,200 characters.");
  }
  if (fullName.length < 2 || fullName.length > 100) {
    throw new ReviewValidationError("Enter your name.");
  }
  if (email && !emailPattern.test(email)) {
    throw new ReviewValidationError("Enter a valid email address.");
  }
  if (body.publishingConsent !== true) {
    throw new ReviewValidationError("Publishing consent is required.");
  }

  return {
    locale: cleanText(body.locale) || "en",
    rating: rating as ReviewSubmission["rating"],
    experience,
    featuresTried: features,
    author: {
      fullName,
      showFirstNameOnly: author.showFirstNameOnly !== false,
      role: optionalText(author.role, 100),
      company: optionalText(author.company, 100),
      email: email || undefined,
    },
    privateImprovementFeedback: optionalText(
      body.privateImprovementFeedback,
      1200,
    ),
    publishingConsent: true,
    website: optionalText(body.website, 200),
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function optionalText(value: unknown, max: number) {
  const text = cleanText(value);
  if (!text) return undefined;
  if (text.length > max) {
    throw new ReviewValidationError(`Text must be ${max} characters or fewer.`);
  }
  return text;
}
