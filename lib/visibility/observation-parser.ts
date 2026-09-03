import type { AnswerObservation } from "@/lib/visibility/types";

export type ParsedAnswerSignals = Pick<
  AnswerObservation,
  "brandMentioned" | "competitorMentions" | "recommendationStrength" | "rankedPosition"
>;

/**
 * A deliberately small, explainable first parser. It avoids converting every
 * brand mention into a recommendation while retaining deterministic decisions
 * that can be versioned and replaced with a reviewed parser later.
 */
export function parseAnswerSignals(input: {
  rawAnswer: string;
  brandName: string;
  competitors: string[];
}): ParsedAnswerSignals {
  const normalizedAnswer = normalize(input.rawAnswer);
  const brand = normalize(input.brandName);
  const brandMentioned = containsEntity(normalizedAnswer, brand);
  const competitorMentions = input.competitors.filter((competitor) =>
    containsEntity(normalizedAnswer, normalize(competitor)),
  );
  const rankedPosition = brandMentioned
    ? rankedPositionForEntity(input.rawAnswer, input.brandName)
    : null;

  if (rankedPosition !== null) {
    return {
      brandMentioned,
      competitorMentions,
      recommendationStrength: "ranked",
      rankedPosition,
    };
  }

  const recommendationStrength =
    brandMentioned && recommendationNearEntity(normalizedAnswer, brand)
      ? "recommended"
      : brandMentioned
        ? "mentioned"
        : "none";

  return {
    brandMentioned,
    competitorMentions,
    recommendationStrength,
    rankedPosition: null,
  };
}

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsEntity(answer: string, entity: string) {
  if (!entity) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(entity)}(?=$|[^\\p{L}\\p{N}])`, "iu").test(
    answer,
  );
}

function rankedPositionForEntity(answer: string, entity: string) {
  const escaped = escapeRegExp(entity);
  const match = answer.match(
    new RegExp(`(?:^|\\n)\\s*(?:#\\s*\\d+|\\d+[.)])\\s*(?:\\*{0,2})?${escaped}\\b`, "imu"),
  );
  if (!match) return null;

  const marker = match[0].match(/#\s*(\d+)|(?:^|\n)\s*(\d+)[.)]/u);
  const position = Number(marker?.[1] ?? marker?.[2]);
  return Number.isInteger(position) && position > 0 && position <= 50 ? position : null;
}

function recommendationNearEntity(answer: string, entity: string) {
  const escaped = escapeRegExp(entity);
  const triggers = "recommended|recommend|best|top choice|strong choice|great option|ideal for|worth considering";
  const expression = new RegExp(
    `(?:${triggers})[^.\\n]{0,180}${escaped}|${escaped}[^.\\n]{0,180}(?:${triggers})`,
    "iu",
  );
  return expression.test(answer);
}
