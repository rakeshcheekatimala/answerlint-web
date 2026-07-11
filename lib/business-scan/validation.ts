import { assertPublicHttpUrl } from "@/lib/net/url-guard";
import {
  BUSINESS_CATEGORIES,
  BUSINESS_SCAN_URL_LIMIT,
  IMPACT_TIERS,
  type BusinessCategory,
  type BusinessImpactTier,
  type BusinessScanPage,
  type BusinessScanProject,
} from "@/lib/business-scan/types";

export class InvalidProjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProjectError";
  }
}

const CATEGORY_SET = new Set<string>(BUSINESS_CATEGORIES);
const IMPACT_SET = new Set<string>(IMPACT_TIERS);

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidProjectError("A project object is required.");
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new InvalidProjectError(`Field "${field}" must be a non-empty string.`);
  }
  return value;
}

function coerceCategory(value: unknown): BusinessCategory {
  return CATEGORY_SET.has(value as string)
    ? (value as BusinessCategory)
    : "Uncategorized";
}

function coerceImpact(value: unknown): BusinessImpactTier {
  return IMPACT_SET.has(value as string)
    ? (value as BusinessImpactTier)
    : "Ignored";
}

function sanitizePage(input: unknown): BusinessScanPage {
  const record = asRecord(input);
  const url = asString(record.url, "page.url");

  return {
    id: asString(record.id, "page.id"),
    url,
    title: typeof record.title === "string" ? record.title.slice(0, 500) : url,
    canonicalUrl:
      typeof record.canonicalUrl === "string" ? record.canonicalUrl : undefined,
    statusCode:
      typeof record.statusCode === "number" ? record.statusCode : undefined,
    category: coerceCategory(record.category),
    impactTier: coerceImpact(record.impactTier),
    included: record.included === true,
    is_manually_categorized: record.is_manually_categorized === true,
    reason: typeof record.reason === "string" ? record.reason.slice(0, 1000) : "",
    confidence:
      typeof record.confidence === "number"
        ? Math.min(1, Math.max(0, record.confidence))
        : 0.5,
    signals: Array.isArray(record.signals)
      ? record.signals.filter((s): s is string => typeof s === "string").slice(0, 20)
      : [],
    source: (record.source as BusinessScanPage["source"]) ?? "internal_link",
    incomingInternalLinks:
      typeof record.incomingInternalLinks === "number"
        ? record.incomingInternalLinks
        : 0,
    isNavigationLinked: record.isNavigationLinked === true,
    isHomepageLinked: record.isHomepageLinked === true,
    contentSummary:
      typeof record.contentSummary === "string" ? record.contentSummary : undefined,
    score: typeof record.score === "number" ? record.score : undefined,
    lastCheckedAt:
      typeof record.lastCheckedAt === "string" ? record.lastCheckedAt : undefined,
  };
}

/**
 * Validates and normalizes an untrusted project payload from the client.
 * - Enforces required fields and types.
 * - Caps the number of pages to the discovery limit.
 * - Drops pages whose host does not match the project base URL host. This is
 *   the critical SSRF allowlist: a client cannot ask the server to audit
 *   arbitrary off-domain (e.g. internal) URLs by hand-crafting the payload.
 */
export function sanitizeProjectPayload(input: unknown): BusinessScanProject {
  const record = asRecord(input);
  const id = asString(record.id, "id");
  const baseUrl = asString(record.baseUrl, "baseUrl");

  const baseHost = assertPublicHttpUrl(baseUrl).hostname;

  const rawPages = Array.isArray(record.pages) ? record.pages : [];
  if (rawPages.length > BUSINESS_SCAN_URL_LIMIT * 4) {
    throw new InvalidProjectError(
      `Too many pages in payload. The maximum is ${BUSINESS_SCAN_URL_LIMIT}.`,
    );
  }

  const pages: BusinessScanPage[] = [];
  for (const rawPage of rawPages) {
    const page = sanitizePage(rawPage);
    let pageHost: string;
    try {
      pageHost = assertPublicHttpUrl(page.url).hostname;
    } catch {
      continue; // Drop unparseable / non-http URLs.
    }
    if (pageHost !== baseHost) continue; // Enforce same-domain allowlist.
    pages.push(page);
    if (pages.length >= BUSINESS_SCAN_URL_LIMIT) break;
  }

  return {
    id,
    baseUrl,
    discoveredUrls: pages.map((page) => page.url),
    pages,
    businessModel:
      typeof record.businessModel === "string"
        ? record.businessModel.slice(0, 200)
        : "Business Website",
    scanHistory: Array.isArray(record.scanHistory)
      ? (record.scanHistory as BusinessScanProject["scanHistory"]).slice(0, 20)
      : [],
    latestScore: typeof record.latestScore === "number" ? record.latestScore : null,
    potentialScore:
      typeof record.potentialScore === "number" ? record.potentialScore : null,
    lostOpportunityScore:
      typeof record.lostOpportunityScore === "number"
        ? record.lostOpportunityScore
        : null,
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    storageStatus:
      record.storageStatus === "stored" || record.storageStatus === "failed"
        ? record.storageStatus
        : "skipped",
    storageError:
      typeof record.storageError === "string" ? record.storageError : undefined,
  };
}
