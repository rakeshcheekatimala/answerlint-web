import { load } from "cheerio";

import { assertPublicUrl, safeFetch } from "@/lib/net/url-guard";
import type {
  LlmsGenerationResult,
  LlmsPage,
  LlmsSection,
} from "@/lib/llms/types";

const sections: LlmsSection[] = [
  "Docs",
  "API",
  "Product",
  "Blog",
  "Site",
  "Optional",
];
const excludedPaths =
  /\/(?:admin|cart|checkout|drafts?|feed|login|logout|private|search|sign-?in|wp-admin)(?:\/|$)/i;
const excludedExtensions =
  /\.(?:avif|css|gif|ico|jpe?g|js|json|map|mp3|mp4|pdf|png|svg|webm|webp|woff2?|xml)$/i;

export type GenerateLlmsInput = {
  url: string;
  publicSite?: string;
  siteName?: string;
  summary?: string;
  includeFull?: boolean;
  maxLinks?: number;
};

export async function generateLlmsFiles(
  input: GenerateLlmsInput,
): Promise<LlmsGenerationResult> {
  const seedUrl = normalizeHttpUrl(input.url);
  const publicOrigin = input.publicSite
    ? (await assertPublicUrl(input.publicSite)).origin
    : seedUrl.origin;
  const maxLinks = Math.min(Math.max(input.maxLinks ?? 20, 1), 30);

  const seedHtml = await fetchText(seedUrl.toString(), "text/html");
  const discovered = await discoverUrls(seedUrl, seedHtml, maxLinks);
  const urls = rankUrls([seedUrl.toString(), ...discovered], seedUrl.origin).slice(
    0,
    maxLinks,
  );

  const pages = (
    await Promise.all(
      urls.map(async (url) => {
        try {
          const html = url === seedUrl.toString() ? seedHtml : await fetchText(url, "text/html");
          return extractPage(toPublicUrl(url, publicOrigin), html);
        } catch {
          return null;
        }
      }),
    )
  ).filter((page): page is LlmsPage => Boolean(page));

  if (pages.length === 0) {
    throw new Error("No readable public pages were found.");
  }

  const siteName = cleanInline(input.siteName) || inferSiteName(publicOrigin);
  const summary =
    cleanInline(input.summary) ||
    pages[0].description ||
    `${siteName} provides curated website content for humans and AI agents.`;

  const llmsTxt = renderLlmsTxt(siteName, summary, pages);
  return {
    llmsTxt,
    llmsFullTxt: input.includeFull
      ? renderLlmsFullTxt(siteName, summary, pages, 200_000)
      : undefined,
    sourceCount: pages.length,
    siteName,
    warnings:
      pages.length < urls.length
        ? [`${urls.length - pages.length} discovered page(s) could not be read.`]
        : [],
  };
}

async function discoverUrls(seed: URL, html: string, maxLinks: number) {
  const sitemapCandidates = [
    `${seed.origin}/sitemap.xml`,
    `${seed.origin}/sitemap_index.xml`,
  ];
  const sitemapUrls = new Set<string>();

  for (const candidate of sitemapCandidates) {
    try {
      const xml = await fetchText(candidate, "xml");
      const parsed = extractSitemapUrls(xml);
      for (const url of parsed.pages) {
        if (new URL(url).origin === seed.origin) sitemapUrls.add(url);
        if (sitemapUrls.size >= maxLinks * 3) break;
      }
      for (const nestedSitemap of parsed.sitemaps.slice(0, 4)) {
        if (new URL(nestedSitemap).origin !== seed.origin) continue;
        try {
          const nestedXml = await fetchText(nestedSitemap, "xml");
          for (const url of extractSitemapUrls(nestedXml).pages) {
            if (new URL(url).origin === seed.origin) sitemapUrls.add(url);
            if (sitemapUrls.size >= maxLinks * 3) break;
          }
        } catch {
          // Continue with other sitemap files.
        }
      }
    } catch {
      // Sitemap discovery is best-effort; homepage links are the fallback.
    }
    if (sitemapUrls.size > 0) break;
  }

  if (sitemapUrls.size > 0) return [...sitemapUrls];

  const $ = load(html);
  const links = new Set<string>();
  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    try {
      const url = new URL(href, seed);
      if (url.origin === seed.origin && isContentUrl(url)) {
        links.add(canonicalUrl(url));
      }
    } catch {
      // Ignore malformed links discovered in third-party markup.
    }
  });
  return [...links];
}

function extractSitemapUrls(xml: string) {
  const $ = load(xml, { xmlMode: true });
  const getLocations = (selector: string) =>
    $(selector)
      .map((_index, element) => $(element).text().trim())
      .get()
      .filter(Boolean);
  return {
    pages: getLocations("url > loc"),
    sitemaps: getLocations("sitemap > loc"),
  };
}

async function fetchText(url: string, expected: "text/html" | "xml") {
  const response = await safeFetch(url, {
    headers: { "user-agent": "AnswerLint/1.2 (+https://useanswerlint.com)" },
    timeoutMs: 10_000,
    maxBytes: 2 * 1024 * 1024,
  });
  if (!response.ok) throw new Error(`Could not fetch ${url}.`);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (expected === "text/html" && !contentType.includes("html")) {
    throw new Error(`Expected an HTML page at ${url}.`);
  }
  return response.text();
}

function extractPage(url: string, html: string): LlmsPage {
  const $ = load(html);
  $("script, style, noscript, template, svg, nav, footer, header, aside").remove();
  const title =
    cleanInline($('meta[property="og:title"]').attr("content")) ||
    cleanInline($("title").first().text()) ||
    cleanInline($("h1").first().text()) ||
    titleFromUrl(url);
  const description =
    cleanInline($('meta[name="description"]').attr("content")) ||
    cleanInline($('meta[property="og:description"]').attr("content")) ||
    cleanInline($("main p").first().text()) ||
    cleanInline($("p").first().text()) ||
    `Information about ${title}.`;

  return {
    url,
    title,
    description: truncate(description, 220),
    section: classifySection(url),
    text: cleanBlock($("main").text() || $("body").text()).slice(0, 30_000),
  };
}

function renderLlmsTxt(siteName: string, summary: string, pages: LlmsPage[]) {
  const lines = [
    `# ${escapeMarkdown(siteName)}`,
    "",
    `> ${escapeMarkdown(summary)}`,
    "",
    `Generated by AnswerLint from ${pages.length} deterministic content source${pages.length === 1 ? "" : "s"}.`,
    "",
  ];
  for (const section of sections) {
    const sectionPages = pages.filter((page) => page.section === section);
    if (!sectionPages.length) continue;
    lines.push(`## ${section}`, "");
    for (const page of sectionPages) {
      lines.push(
        `- [${page.title.replace(/[[\]]/g, "")}](${page.url}): ${escapeMarkdown(page.description)}`,
      );
    }
    lines.push("");
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function renderLlmsFullTxt(
  siteName: string,
  summary: string,
  pages: LlmsPage[],
  maxChars: number,
) {
  const lines = [
    `# ${escapeMarkdown(siteName)} Full Context`,
    "",
    `> ${escapeMarkdown(summary)}`,
    "",
  ];
  for (const section of sections) {
    const sectionPages = pages.filter((page) => page.section === section);
    if (!sectionPages.length) continue;
    lines.push(`## ${section}`, "");
    for (const page of sectionPages) {
      const remaining = maxChars - lines.join("\n").length;
      if (remaining <= 0) break;
      lines.push(
        `### ${escapeMarkdown(page.title)}`,
        "",
        `Source: ${page.url}`,
        "",
        escapeMarkdown(page.description),
        "",
        escapeMarkdown(page.text).slice(0, remaining),
        "",
      );
    }
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function rankUrls(urls: string[], origin: string) {
  return [...new Set(urls.map((url) => canonicalUrl(new URL(url))))]
    .filter((url) => new URL(url).origin === origin && isContentUrl(new URL(url)))
    .sort((left, right) => urlRank(left) - urlRank(right) || left.localeCompare(right));
}

function urlRank(value: string) {
  const path = new URL(value).pathname.toLowerCase();
  if (path === "/") return 0;
  if (/\/(?:docs?|documentation|guides?|learn)(?:\/|$)/.test(path)) return 10;
  if (/\/(?:api|reference|sdk|cli)(?:\/|$)/.test(path)) return 20;
  if (/\/(?:features|pricing|product|solutions|customers)(?:\/|$)/.test(path)) return 30;
  if (/\/(?:about|contact|company)(?:\/|$)/.test(path)) return 40;
  if (/\/(?:blog|posts|articles|news)(?:\/|$)/.test(path)) return 50;
  return 60;
}

function classifySection(value: string): LlmsSection {
  const path = new URL(value).pathname.toLowerCase();
  if (/\/(?:api|reference|sdk|cli)(?:\/|$)/.test(path)) return "API";
  if (/\/(?:docs?|documentation|guides?|learn)(?:\/|$)/.test(path)) return "Docs";
  if (/\/(?:blog|posts|articles|news)(?:\/|$)/.test(path)) return "Blog";
  if (/\/(?:pricing|features|product|solutions|customers)(?:\/|$)/.test(path)) return "Product";
  if (/\/(?:changelog|releases|legal|privacy|terms|contact)(?:\/|$)/.test(path)) return "Optional";
  return "Site";
}

function normalizeHttpUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Enter a public http or https URL.");
  }
  url.hash = "";
  return url;
}

function canonicalUrl(url: URL) {
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function toPublicUrl(value: string, publicOrigin: string) {
  const source = new URL(value);
  const publicUrl = new URL(publicOrigin);
  publicUrl.pathname = source.pathname;
  publicUrl.search = source.search;
  return canonicalUrl(publicUrl);
}

function isContentUrl(url: URL) {
  return (
    ["http:", "https:"].includes(url.protocol) &&
    !excludedPaths.test(url.pathname) &&
    !excludedExtensions.test(url.pathname)
  );
}

function inferSiteName(origin: string) {
  return new URL(origin).hostname.replace(/^www\./, "");
}

function titleFromUrl(value: string) {
  const leaf =
    new URL(value).pathname.replace(/\/+$/, "").split("/").filter(Boolean).pop() ??
    "Home";
  return leaf
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cleanInline(value?: string) {
  return cleanBlock(value ?? "").replace(/\s+([,.;:!?])/g, "$1");
}

function cleanBlock(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  const shortened = value.slice(0, max - 1);
  const space = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, Math.max(1, space))}.`;
}

function escapeMarkdown(value: string) {
  return value.replace(/\r?\n/g, " ").trim();
}
