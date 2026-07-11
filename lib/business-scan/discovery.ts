import crypto from "node:crypto";

import { assertPublicUrl, safeFetch } from "@/lib/net/url-guard";
import {
  createBusinessScanPage,
  mergePageRefresh,
} from "@/lib/business-scan/classification";
import {
  BUSINESS_CATEGORIES,
  BUSINESS_SCAN_URL_LIMIT,
  type BusinessCategory,
  type BusinessScanPage,
  type BusinessScanPageSource,
  type BusinessScanProject,
  type DiscoveryProgressEvent,
} from "@/lib/business-scan/types";

type ProgressCallback = (event: Extract<DiscoveryProgressEvent, { type: "status" | "fallback" }>) => void;

type Candidate = {
  url: string;
  source: BusinessScanPageSource;
  isNavigationLinked: boolean;
  isHomepageLinked: boolean;
};

type PageMetadata = {
  url: string;
  finalUrl: string;
  title: string;
  canonicalUrl?: string;
  statusCode: number;
  html: string;
};

const STATIC_FILE_PATTERN =
  /\.(?:avif|css|csv|docx?|gif|ico|jpe?g|js|json|mp3|mp4|pdf|png|pptx?|svg|txt|webm|webp|xlsx?|xml|zip)$/i;

export async function discoverBusinessScanProject(
  baseUrlInput: string,
  options: {
    existingPages?: BusinessScanPage[];
    onProgress?: ProgressCallback;
  } = {},
): Promise<BusinessScanProject> {
  const startedAt = Date.now();
  const baseUrl = normalizeBaseUrl(baseUrlInput);
  const base = new URL(baseUrl);

  // Block SSRF at the entry point: the base host must be a public address.
  await assertPublicUrl(baseUrl);
  const candidates = new Map<string, Candidate>();
  const incomingLinkCounts = new Map<string, number>();
  const homepageNavLinks = new Set<string>();
  const homepageLinks = new Set<string>();
  const pages: BusinessScanPage[] = [];
  const seen = new Set<string>();
  let fallbackSent = false;

  const emit = (message: string) => {
    const groups = summarizeGroups(pages);
    options.onProgress?.({
      type: "status",
      message,
      pageCount: pages.length,
      groups,
    });

    if (!fallbackSent && Date.now() - startedAt > 15000) {
      fallbackSent = true;
      options.onProgress?.({
        type: "fallback",
        message: "Continue in background and notify me when ready.",
        pageCount: pages.length,
      });
    }
  };

  const addCandidate = (candidateUrl: string, source: BusinessScanPageSource) => {
    const normalized = normalizeInternalUrl(candidateUrl, base);
    if (!normalized || seen.has(normalized)) return;
    const current = candidates.get(normalized);

    candidates.set(normalized, {
      url: normalized,
      source: pickBestSource(current?.source, source),
      isNavigationLinked: current?.isNavigationLinked ?? source === "navigation",
      isHomepageLinked: current?.isHomepageLinked ?? source === "internal_link",
    });
  };

  emit("Finding business pages");
  addCandidate(baseUrl, "base_url");

  emit("Checking sitemap");
  for (const sitemapUrl of await discoverSitemapUrls(base)) {
    addCandidate(sitemapUrl, "sitemap");
  }

  emit("Checking homepage links");
  const homepage = await fetchPageMetadata(baseUrl).catch(() => null);
  if (homepage) {
    const links = extractLinks(homepage.html, homepage.finalUrl);
    const navLinks = extractNavigationLinks(homepage.html, homepage.finalUrl);

    for (const link of links) {
      const normalized = normalizeInternalUrl(link, base);
      if (!normalized) continue;
      homepageLinks.add(normalized);
      increment(incomingLinkCounts, normalized);
      addCandidate(normalized, navLinks.includes(link) ? "navigation" : "internal_link");
    }

    for (const link of navLinks) {
      const normalized = normalizeInternalUrl(link, base);
      if (!normalized) continue;
      homepageNavLinks.add(normalized);
      addCandidate(normalized, "navigation");
    }
  }

  emit("Grouping URLs");

  while (pages.length < BUSINESS_SCAN_URL_LIMIT) {
    const batch = Array.from(candidates.values())
      .filter((candidate) => !seen.has(candidate.url))
      .slice(0, 8);

    if (!batch.length) break;

    await Promise.all(
      batch.map(async (candidate) => {
        if (pages.length >= BUSINESS_SCAN_URL_LIMIT) return;
        seen.add(candidate.url);
        const metadata = await fetchPageMetadata(candidate.url).catch(() => null);
        if (!metadata) return;

        const canonicalUrl = metadata.canonicalUrl
          ? normalizeInternalUrl(metadata.canonicalUrl, base) ?? undefined
          : undefined;
        if (canonicalUrl) addCandidate(canonicalUrl, "canonical");

        const page = createBusinessScanPage({
          id: createPageId(metadata.finalUrl),
          url: metadata.finalUrl,
          title: metadata.title,
          canonicalUrl,
          statusCode: metadata.statusCode,
          source: candidate.source,
          incomingInternalLinks: incomingLinkCounts.get(candidate.url) ?? 0,
          isNavigationLinked:
            candidate.isNavigationLinked || homepageNavLinks.has(candidate.url),
          isHomepageLinked:
            candidate.isHomepageLinked || homepageLinks.has(candidate.url),
        });

        upsertDiscoveredPage(pages, page, options.existingPages);

        for (const link of extractLinks(metadata.html, metadata.finalUrl)) {
          const normalized = normalizeInternalUrl(link, base);
          if (!normalized || seen.has(normalized)) continue;
          increment(incomingLinkCounts, normalized);
          addCandidate(normalized, "internal_link");
        }
      }),
    );

    emit("Detecting page purpose");
  }

  const sortedPages = pages
    .sort((left, right) => rankPage(right) - rankPage(left))
    .slice(0, BUSINESS_SCAN_URL_LIMIT);

  emit("Preparing your business map");

  const now = new Date().toISOString();
  return {
    id: `local_${crypto.randomUUID()}`,
    baseUrl,
    discoveredUrls: sortedPages.map((page) => page.url),
    pages: sortedPages,
    businessModel: detectBusinessModel(sortedPages),
    scanHistory: [],
    latestScore: null,
    potentialScore: null,
    lostOpportunityScore: null,
    createdAt: now,
    updatedAt: now,
    storageStatus: "skipped",
  };
}

export function normalizeBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("A base URL is required.");

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(candidate);
  url.hash = "";
  url.search = "";

  return normalizeUrlString(url);
}

export function detectBusinessModel(pages: BusinessScanPage[]) {
  const counts = summarizeGroups(pages).reduce(
    (acc, group) => ({ ...acc, [group.category]: group.count }),
    {} as Record<BusinessCategory, number>,
  );

  if ((counts["Developer Pages"] ?? 0) >= 4) return "Developer Platform";
  if ((counts["Revenue Pages"] ?? 0) >= 2 && (counts["Trust Pages"] ?? 0) >= 2) {
    return "SaaS Marketing Site";
  }
  if ((counts["Content Pages"] ?? 0) > (counts["Revenue Pages"] ?? 0)) {
    return "Content-Led Business";
  }

  return "Business Website";
}

export function upsertDiscoveredPage(
  pages: BusinessScanPage[],
  page: BusinessScanPage,
  existingPages: BusinessScanPage[] = [],
) {
  const savedPage = existingPages.find(
    (existingPage) => existingPage.id === page.id || existingPage.url === page.url,
  );
  const nextPage = savedPage ? mergePageRefresh(savedPage, page) : page;
  const duplicateIndex = pages.findIndex(
    (currentPage) =>
      currentPage.id === nextPage.id || currentPage.url === nextPage.url,
  );

  if (duplicateIndex === -1) {
    pages.push(nextPage);
    return;
  }

  pages[duplicateIndex] = mergePageRefresh(pages[duplicateIndex], {
    ...nextPage,
    incomingInternalLinks: Math.max(
      pages[duplicateIndex].incomingInternalLinks,
      nextPage.incomingInternalLinks,
    ),
    isNavigationLinked:
      pages[duplicateIndex].isNavigationLinked || nextPage.isNavigationLinked,
    isHomepageLinked:
      pages[duplicateIndex].isHomepageLinked || nextPage.isHomepageLinked,
  });
}

function summarizeGroups(pages: BusinessScanPage[]) {
  return BUSINESS_CATEGORIES.map((category) => ({
    category,
    count: pages.filter((page) => page.category === category).length,
  })).filter((group) => group.count > 0);
}

async function discoverSitemapUrls(base: URL) {
  const sitemapUrls = new Set<string>([new URL("/sitemap.xml", base).toString()]);
  const robotsText = await fetchText(new URL("/robots.txt", base).toString()).catch(
    () => "",
  );

  for (const match of robotsText.matchAll(/^sitemap:\s*(.+)$/gim)) {
    sitemapUrls.add(match[1].trim());
  }

  const discovered = new Set<string>();
  const queue = Array.from(sitemapUrls).slice(0, 12);

  while (queue.length && discovered.size < BUSINESS_SCAN_URL_LIMIT) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl) break;
    const xml = await fetchText(sitemapUrl).catch(() => "");
    if (!xml) continue;

    for (const loc of extractXmlLocs(xml)) {
      if (/sitemap/i.test(loc) && queue.length < 20) {
        queue.push(loc);
      } else {
        discovered.add(loc);
      }
      if (discovered.size >= BUSINESS_SCAN_URL_LIMIT) break;
    }
  }

  return Array.from(discovered);
}

const MAX_HTML_CHARS = 3_000_000;

async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  const response = await safeFetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; AnswerLintBusinessScan/1.0; +https://useanswerlint.com)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error("Page is not HTML.");
  }

  const html = (await response.text()).slice(0, MAX_HTML_CHARS);
  const finalUrl = response.url || url;
  return {
    url,
    finalUrl: normalizeUrlString(new URL(finalUrl)),
    title: extractTitle(html),
    canonicalUrl: extractCanonicalUrl(html, finalUrl),
    statusCode: response.status,
    html,
  };
}

async function fetchText(url: string) {
  const response = await safeFetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; AnswerLintBusinessScan/1.0; +https://useanswerlint.com)",
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.text()).slice(0, MAX_HTML_CHARS);
}

function normalizeInternalUrl(value: string, base: URL) {
  try {
    const url = new URL(value, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.hostname !== base.hostname) return null;
    if (STATIC_FILE_PATTERN.test(url.pathname)) return null;

    url.hash = "";
    url.search = "";

    return normalizeUrlString(url);
  } catch {
    return null;
  }
}

function normalizeUrlString(url: URL) {
  const normalized = url.toString();
  if (url.pathname === "/") return normalized;
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function extractXmlLocs(xml: string) {
  return Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)).map((match) =>
    decodeHtml(match[1].trim()),
  );
}

function extractTitle(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "";
  return cleanText(title || h1);
}

function extractCanonicalUrl(html: string, baseUrl: string) {
  const match = html.match(
    /<link\b(?=[^>]*rel=["'][^"']*canonical[^"']*["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>/i,
  );
  if (!match?.[1]) return undefined;
  return new URL(decodeHtml(match[1]), baseUrl).toString();
}

function extractLinks(html: string, baseUrl: string) {
  return Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi))
    .map((match) => new URL(decodeHtml(match[1]), baseUrl).toString())
    .filter(Boolean);
}

function extractNavigationLinks(html: string, baseUrl: string) {
  return Array.from(html.matchAll(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gi)).flatMap(
    (match) => extractLinks(match[1], baseUrl),
  );
}

function cleanText(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function createPageId(url: string) {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function pickBestSource(
  current: BusinessScanPageSource | undefined,
  next: BusinessScanPageSource,
) {
  const rank: Record<BusinessScanPageSource, number> = {
    navigation: 5,
    base_url: 4,
    sitemap: 3,
    canonical: 2,
    robots: 1,
    internal_link: 0,
  };

  return !current || rank[next] > rank[current] ? next : current;
}

function rankPage(page: BusinessScanPage) {
  const categoryRank: Record<BusinessCategory, number> = {
    "Revenue Pages": 70,
    "Trust Pages": 60,
    "Developer Pages": 50,
    "Support Pages": 40,
    "Content Pages": 30,
    "Low Priority / Legal": 10,
    Uncategorized: 0,
  };

  return (
    categoryRank[page.category] +
    page.confidence * 10 +
    page.incomingInternalLinks +
    (page.isNavigationLinked ? 10 : 0) +
    (page.isHomepageLinked ? 5 : 0)
  );
}
