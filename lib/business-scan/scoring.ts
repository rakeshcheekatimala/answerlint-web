import {
  BUSINESS_CATEGORIES,
  CATEGORY_WEIGHTS,
  IMPACT_SHARES,
  type BusinessCategory,
  type BusinessScanPage,
  type BusinessScoreResult,
  type CategoryScoreBreakdown,
  type PageScoreContribution,
} from "@/lib/business-scan/types";

export function getIncludedScoredPages(pages: BusinessScanPage[]) {
  return pages.filter(
    (page) =>
      page.included &&
      page.impactTier !== "Ignored" &&
      CATEGORY_WEIGHTS[page.category] > 0 &&
      IMPACT_SHARES[page.impactTier] > 0,
  );
}

export function computeBusinessVisibilityScore(
  pages: BusinessScanPage[],
): BusinessScoreResult {
  const activePages = getIncludedScoredPages(pages);
  const pagesByCategory = groupPagesByCategory(activePages);
  const activeCategories = BUSINESS_CATEGORIES.filter(
    (category) =>
      CATEGORY_WEIGHTS[category] > 0 &&
      totalCategoryShares(pagesByCategory.get(category) ?? []) > 0,
  );
  const activeBaseWeightTotal = activeCategories.reduce(
    (sum, category) => sum + CATEGORY_WEIGHTS[category],
    0,
  );

  if (!activeBaseWeightTotal) {
    return {
      currentScore: 0,
      scoringMix: BUSINESS_CATEGORIES.map((category) =>
        createEmptyCategoryScore(category, false),
      ),
      pageContributions: [],
      excludedCategoryMessages: [
        "Include at least one business page to calculate a Business Visibility Score.",
      ],
    };
  }

  const pageContributions: PageScoreContribution[] = [];
  const scoringMix = BUSINESS_CATEGORIES.map((category) => {
    const categoryPages = pagesByCategory.get(category) ?? [];
    const totalShares = totalCategoryShares(categoryPages);
    const activeWeight =
      totalShares > 0
        ? CATEGORY_WEIGHTS[category] / activeBaseWeightTotal
        : 0;
    const categoryScore = categoryPages.reduce((sum, page) => {
      const pageShare = IMPACT_SHARES[page.impactTier] / totalShares;
      const pageScore = clampScore(page.score ?? 0);
      const projectWeight = activeWeight * pageShare;
      const projectPoints = pageScore * projectWeight;
      const recoverableProjectPoints = (100 - pageScore) * projectWeight;

      pageContributions.push({
        pageId: page.id,
        category,
        pageScore,
        projectWeight,
        projectPoints,
        recoverableProjectPoints,
      });

      return sum + pageScore * pageShare;
    }, 0);

    return {
      category,
      baseWeight: CATEGORY_WEIGHTS[category],
      activeWeight,
      score: roundScore(categoryScore),
      includedPages: categoryPages.length,
      totalShares,
      redistributed: CATEGORY_WEIGHTS[category] > 0 && totalShares === 0,
    } satisfies CategoryScoreBreakdown;
  });

  const currentScore = scoringMix.reduce(
    (sum, category) => sum + category.score * category.activeWeight,
    0,
  );

  return {
    currentScore: roundScore(currentScore),
    scoringMix,
    pageContributions,
    excludedCategoryMessages: scoringMix
      .filter((category) => category.redistributed)
      .map(
        (category) =>
          `${category.category} are excluded from this scan. Their budget will be redistributed across active categories.`,
      ),
  };
}

export function summarizeReviewState(pages: BusinessScanPage[]) {
  const includedPages = getIncludedScoredPages(pages);
  const ignoredPages = pages.filter(
    (page) => !page.included || page.impactTier === "Ignored",
  );
  const pagesNeedingReview = pages.filter(
    (page) => page.category === "Uncategorized" || page.confidence < 0.55,
  );
  const allIncludedVeryHigh =
    includedPages.length > 0 &&
    includedPages.every((page) => page.impactTier === "Very High");

  return {
    totalPages: pages.length,
    includedPages: includedPages.length,
    ignoredPages: ignoredPages.length,
    pagesNeedingReview: pagesNeedingReview.length,
    allIncludedVeryHigh,
    tooFewPagesIncluded: includedPages.length > 0 && includedPages.length < 4,
    hasNoIncludedPages: includedPages.length === 0,
  };
}

export function formatScoringMix(scoringMix: CategoryScoreBreakdown[]) {
  return scoringMix.map((category) => ({
    category: category.category,
    label:
      category.activeWeight > 0
        ? `${Math.round(category.activeWeight * 100)}%`
        : "Excluded",
  }));
}

function groupPagesByCategory(pages: BusinessScanPage[]) {
  const grouped = new Map<BusinessCategory, BusinessScanPage[]>();

  for (const page of pages) {
    grouped.set(page.category, [...(grouped.get(page.category) ?? []), page]);
  }

  return grouped;
}

function totalCategoryShares(pages: BusinessScanPage[]) {
  return pages.reduce((sum, page) => sum + IMPACT_SHARES[page.impactTier], 0);
}

function createEmptyCategoryScore(
  category: BusinessCategory,
  redistributed: boolean,
): CategoryScoreBreakdown {
  return {
    category,
    baseWeight: CATEGORY_WEIGHTS[category],
    activeWeight: 0,
    score: 0,
    includedPages: 0,
    totalShares: 0,
    redistributed,
  };
}

function clampScore(score: number) {
  return Math.min(100, Math.max(0, score));
}

function roundScore(score: number) {
  return Math.round(score * 10) / 10;
}
