import {
  type BusinessCategory,
  type BusinessImpactTier,
  type BusinessScanPage,
  type BusinessScanPageSource,
} from "@/lib/business-scan/types";

type ClassificationInput = {
  url: string;
  title?: string;
  source: BusinessScanPageSource;
  incomingInternalLinks?: number;
  isNavigationLinked?: boolean;
  isHomepageLinked?: boolean;
  canonicalUrl?: string;
};

type ClassificationResult = Pick<
  BusinessScanPage,
  "category" | "impactTier" | "included" | "reason" | "confidence" | "signals"
>;

type CategoryRule = {
  category: BusinessCategory;
  pathKeywords: string[];
  titleKeywords: string[];
  reason: string;
  impactTier: BusinessImpactTier;
};

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "Revenue Pages",
    pathKeywords: [
      "pricing",
      "price",
      "product",
      "products",
      "plans",
      "demo",
      "contact-sales",
      "sales",
      "signup",
      "sign-up",
      "trial",
      "landing",
      "solutions",
    ],
    titleKeywords: [
      "pricing",
      "plans",
      "product",
      "demo",
      "contact sales",
      "sign up",
      "free trial",
      "solutions",
    ],
    reason: "Detected conversion intent and likely revenue relevance.",
    impactTier: "Very High",
  },
  {
    category: "Trust Pages",
    pathKeywords: [
      "about",
      "customers",
      "case-studies",
      "case-study",
      "testimonials",
      "security",
      "compliance",
      "trust",
      "reviews",
    ],
    titleKeywords: [
      "about",
      "customers",
      "case studies",
      "testimonials",
      "security",
      "compliance",
      "trust",
    ],
    reason: "Detected trust and credibility signals.",
    impactTier: "High",
  },
  {
    category: "Developer Pages",
    pathKeywords: [
      "docs",
      "documentation",
      "api",
      "sdk",
      "changelog",
      "integrations",
      "developers",
      "developer",
      "guides",
      "reference",
    ],
    titleKeywords: [
      "docs",
      "documentation",
      "api",
      "sdk",
      "changelog",
      "integrations",
      "developer guide",
      "reference",
    ],
    reason: "Detected documentation structure and developer adoption relevance.",
    impactTier: "High",
  },
  {
    category: "Support Pages",
    pathKeywords: [
      "faq",
      "help",
      "support",
      "contact",
      "troubleshooting",
      "questions",
      "kb",
    ],
    titleKeywords: [
      "faq",
      "help",
      "support",
      "contact",
      "troubleshooting",
      "questions",
    ],
    reason: "Detected support intent and customer-help relevance.",
    impactTier: "Medium",
  },
  {
    category: "Content Pages",
    pathKeywords: [
      "blog",
      "guides",
      "guide",
      "resources",
      "articles",
      "article",
      "learn",
      "insights",
      "thought-leadership",
      "whitepaper",
      "webinar",
    ],
    titleKeywords: [
      "blog",
      "guide",
      "resources",
      "article",
      "learn",
      "insights",
      "thought leadership",
      "whitepaper",
      "webinar",
    ],
    reason: "Detected educational content that can shape AI understanding.",
    impactTier: "Low",
  },
  {
    category: "Low Priority / Legal",
    pathKeywords: [
      "privacy",
      "terms",
      "cookie",
      "cookies",
      "legal",
      "accessibility",
      "gdpr",
      "dpa",
    ],
    titleKeywords: [
      "privacy",
      "terms",
      "cookies",
      "legal",
      "accessibility statement",
      "gdpr",
      "data processing",
    ],
    reason:
      "Legal page detected. Ignored by default because it usually should not affect business visibility.",
    impactTier: "Ignored",
  },
];

export function classifyBusinessPage(input: ClassificationInput): ClassificationResult {
  const url = new URL(input.url);
  const pathText = decodeURIComponent(url.pathname)
    .replace(/[-_./]+/g, " ")
    .toLowerCase();
  const titleText = (input.title ?? "").toLowerCase();
  const signals: string[] = [];

  for (const rule of CATEGORY_RULES) {
    const pathMatches = rule.pathKeywords.filter((keyword) =>
      pathText.includes(keyword.replace(/-/g, " ")),
    );
    const titleMatches = rule.titleKeywords.filter((keyword) =>
      titleText.includes(keyword),
    );

    if (!pathMatches.length && !titleMatches.length) continue;

    if (pathMatches.length) {
      signals.push(`URL matched ${pathMatches.slice(0, 3).join(", ")}`);
    }
    if (titleMatches.length) {
      signals.push(`Title matched ${titleMatches.slice(0, 3).join(", ")}`);
    }
    addPlacementSignals(input, signals);

    const confidence = clampConfidence(
      0.62 +
        pathMatches.length * 0.08 +
        titleMatches.length * 0.06 +
        (input.isNavigationLinked ? 0.08 : 0) +
        (input.isHomepageLinked ? 0.06 : 0),
    );

    return {
      category: rule.category,
      impactTier: rule.impactTier,
      included: rule.category !== "Low Priority / Legal",
      reason: rule.reason,
      confidence,
      signals,
    };
  }

  if (url.pathname === "/" || url.pathname === "") {
    addPlacementSignals(input, signals);
    return {
      category: "Revenue Pages",
      impactTier: "Very High",
      included: true,
      reason:
        "Homepage included because it usually introduces the business and primary conversion paths.",
      confidence: input.isNavigationLinked ? 0.82 : 0.76,
      signals: ["Homepage", ...signals],
    };
  }

  addPlacementSignals(input, signals);

  return {
    category: "Uncategorized",
    impactTier: "Ignored",
    included: false,
    reason:
      "No confident business footprint detected. Excluded by default until reviewed.",
    confidence: 0.38,
    signals,
  };
}

export function createBusinessScanPage(
  input: ClassificationInput & { id: string; statusCode?: number },
): BusinessScanPage {
  const classification = classifyBusinessPage(input);

  return {
    id: input.id,
    url: input.url,
    title: input.title?.trim() || formatUrlTitle(input.url),
    canonicalUrl: input.canonicalUrl,
    statusCode: input.statusCode,
    source: input.source,
    incomingInternalLinks: input.incomingInternalLinks ?? 0,
    isNavigationLinked: input.isNavigationLinked ?? false,
    isHomepageLinked: input.isHomepageLinked ?? false,
    is_manually_categorized: false,
    lastCheckedAt: new Date().toISOString(),
    ...classification,
  };
}

export function mergePageRefresh(
  existing: BusinessScanPage,
  refreshed: BusinessScanPage,
): BusinessScanPage {
  return {
    ...existing,
    url: refreshed.url,
    title: refreshed.title,
    canonicalUrl: refreshed.canonicalUrl,
    statusCode: refreshed.statusCode,
    source: refreshed.source,
    incomingInternalLinks: refreshed.incomingInternalLinks,
    isNavigationLinked: refreshed.isNavigationLinked,
    isHomepageLinked: refreshed.isHomepageLinked,
    contentSummary: refreshed.contentSummary ?? existing.contentSummary,
    score: refreshed.score ?? existing.score,
    lastCheckedAt: refreshed.lastCheckedAt,
    category: existing.is_manually_categorized
      ? existing.category
      : refreshed.category,
    impactTier: existing.is_manually_categorized
      ? existing.impactTier
      : refreshed.impactTier,
    included: existing.is_manually_categorized
      ? existing.included
      : refreshed.included,
    reason: existing.is_manually_categorized ? existing.reason : refreshed.reason,
    confidence: existing.is_manually_categorized
      ? existing.confidence
      : refreshed.confidence,
    signals: existing.is_manually_categorized ? existing.signals : refreshed.signals,
  };
}

function addPlacementSignals(input: ClassificationInput, signals: string[]) {
  if (input.isNavigationLinked) signals.push("Found in top-level navigation");
  if (input.isHomepageLinked) signals.push("Linked from homepage");
  if ((input.incomingInternalLinks ?? 0) >= 3) {
    signals.push(`${input.incomingInternalLinks} internal links detected`);
  }
  if (input.canonicalUrl && input.canonicalUrl !== input.url) {
    signals.push("Canonical URL points to this business page");
  }
}

function clampConfidence(value: number) {
  return Math.min(0.96, Math.max(0.1, Number(value.toFixed(2))));
}

function formatUrlTitle(value: string) {
  const url = new URL(value);
  const segment = url.pathname.split("/").filter(Boolean).at(-1);
  if (!segment) return url.hostname;

  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
