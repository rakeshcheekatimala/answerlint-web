import type {
  QualityCategory,
  ReviewSubmission,
  SafetyCategory,
} from "@/lib/reviews/types";

export type AutomatedModeration = {
  safetyCategory: SafetyCategory;
  qualityCategory: QualityCategory;
  confidence: number;
  reasons: string[];
};

const abusiveTerms = /\b(?:idiot|moron|stupid|hate you|worthless|trash)\b/i;
const suspiciousLink = /(?:https?:\/\/|www\.)\S+/i;
const personalData = /\b(?:\+?\d[\d\s().-]{8,}\d|(?:password|api key|token)\s*[:=])/i;
const promotionalSpam = /\b(?:buy now|free money|casino|crypto giveaway|backlinks for sale)\b/i;
const criticalLanguage = /\b(?:broken|confusing|difficult|slow|failed|unusable|frustrating|needs work)\b/i;
const productLanguage = /\b(?:answerlint|audit|score|report|cli|ci|content|competitor|aeo|geo|scan|playground)\b/i;

/**
 * Conservative first-pass screening. It never publishes or rejects a review;
 * it only prioritizes the mandatory human moderation queue.
 */
export function screenReview(input: ReviewSubmission): AutomatedModeration {
  const text = `${input.experience} ${input.privateImprovementFeedback ?? ""}`;
  const reasons: string[] = [];
  let safetyCategory: SafetyCategory = "safe";

  if (personalData.test(text)) {
    safetyCategory = "personal_data";
    reasons.push("Possible private credential or phone number detected.");
  } else if (suspiciousLink.test(text)) {
    safetyCategory = "suspicious_links";
    reasons.push("A link requires manual verification.");
  } else if (promotionalSpam.test(text)) {
    safetyCategory = "spam";
    reasons.push("Possible promotional spam detected.");
  } else if (abusiveTerms.test(text)) {
    safetyCategory = "abusive";
    reasons.push("Potentially abusive language detected.");
  }

  let qualityCategory: QualityCategory = "constructive";
  if (input.experience.length < 70) {
    qualityCategory = "vague";
    reasons.push("The public response may need more detail.");
  } else if (!productLanguage.test(text)) {
    qualityCategory = "off_topic";
    reasons.push("No clear AnswerLint workflow was mentioned.");
  } else if (input.rating <= 2 || criticalLanguage.test(text)) {
    qualityCategory = "critical";
    reasons.push("Constructive critical feedback should receive human review.");
  } else {
    reasons.push("The submission references a product workflow.");
  }

  return {
    safetyCategory,
    qualityCategory,
    confidence: 0.72,
    reasons,
  };
}
