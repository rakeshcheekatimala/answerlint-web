import { UnsafeUrlError, safeFetch } from "@/lib/net/url-guard";

export type SiteAuditInput = {
  brandName: string;
  brandUrl: string;
  category: string;
  customer: string;
  questions: string[];
  competitors: Array<{ name: string; url: string }>;
};

export type PageRole = "brand" | "competitor";

export type PageProbe = {
  role: PageRole;
  name: string;
  url: string;
  opened: boolean;
  statusCode: number | null;
  error: string | null;
  title: string | null;
  heading: string | null;
  canonical: string | null;
  hasDirectAnswer: boolean;
  schemaTypes: string[];
  citationSignals: string[];
};

export type TechnicalRow = {
  id: string;
  label: string;
  status: "pass" | "needs_work" | "waiting";
  detail: string;
};

export type AuditFix = {
  rank: number;
  title: string;
  why: string;
};

export type SiteAuditReport = {
  brandName: string;
  headline: string;
  citationNote: string;
  citationRows: Array<{
    name: string;
    role: "you" | "competitor";
    share: null;
  }>;
  questions: Array<{ text: string; status: "not_scored" }>;
  questionNote: string;
  pages: Array<PageProbe & { checks: TechnicalRow[] }>;
  fixes: AuditFix[];
  fixesNote: string;
};

const FETCH_TIMEOUT_MS = 10_000;
const FETCH_MAX_BYTES = 4_000_000;

export function readPageSignals(html: string) {
  const title = textOf(firstTag(html, "title"));
  const heading = textOf(firstTag(html, "h1"));
  const canonical = linkHref(html, "canonical");
  const description = metaContent(html, "name", "description");
  const paragraph = textOf(firstTag(html, "p"));
  const schemaTypes = readSchemaTypes(html);
  const citationSignals = citationSignalsFrom(html, schemaTypes);

  return {
    title,
    heading,
    canonical,
    hasDirectAnswer: Boolean(
      (description && description.length >= 40) || (paragraph && paragraph.length >= 40),
    ),
    schemaTypes,
    citationSignals,
  };
}

export function buildSiteAuditReport(
  input: SiteAuditInput,
  pages: PageProbe[],
): SiteAuditReport {
  const withChecks = pages.map((page) => ({
    ...page,
    checks: checksFor(page),
  }));
  const fixes = fixesFor(withChecks.find((page) => page.role === "brand"));

  return {
    brandName: input.brandName,
    headline: `${input.brandName}: citation share is not measured. The technical check covers the public pages you named.`,
    citationNote:
      "Citation share counts sources an answer cites. This page does not ask an answer engine, so every share stays blank.",
    citationRows: [
      { name: input.brandName, role: "you", share: null },
      ...input.competitors.map((competitor) => ({
        name: competitor.name,
        role: "competitor" as const,
        share: null as null,
      })),
    ],
    questions: input.questions.map((text) => ({ text, status: "not_scored" as const })),
    questionNote:
      "Score these buyer questions by hand. A prompt is missing only when your brand is absent. This page does not invent that result.",
    pages: withChecks,
    fixes,
    fixesNote:
      fixes.length === 0
        ? "The brand page opened and the checked signals are present. No fix is listed."
        : fixes.length < 5
          ? `${fixes.length} of 5 fixes come from the brand page check. The rest stay blank.`
          : "The first five gaps on the brand page.",
  };
}

export async function collectSiteAudit(input: SiteAuditInput): Promise<SiteAuditReport> {
  const targets: Array<{ role: PageRole; name: string; url: string }> = [
    { role: "brand", name: input.brandName, url: input.brandUrl },
    ...input.competitors.map((competitor) => ({
      role: "competitor" as const,
      name: competitor.name,
      url: competitor.url,
    })),
  ];
  const pages = await Promise.all(targets.map((target) => probePage(target)));
  return buildSiteAuditReport(input, pages);
}

export async function probePage(target: {
  role: PageRole;
  name: string;
  url: string;
}): Promise<PageProbe> {
  const blank = {
    role: target.role,
    name: target.name,
    url: target.url,
    opened: false,
    statusCode: null as number | null,
    error: null as string | null,
    title: null,
    heading: null,
    canonical: null,
    hasDirectAnswer: false,
    schemaTypes: [] as string[],
    citationSignals: [] as string[],
  };

  try {
    const response = await safeFetch(target.url, {
      timeoutMs: FETCH_TIMEOUT_MS,
      maxBytes: FETCH_MAX_BYTES,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "AnswerLintSiteAudit/1.0",
      },
    });
    if (!response.ok) {
      return { ...blank, statusCode: response.status, error: `The site returned ${response.status}.` };
    }
    const type = response.headers.get("content-type") ?? "";
    if (!/html|xml/i.test(type)) {
      return {
        ...blank,
        opened: true,
        statusCode: response.status,
        error: "The URL opened, but it is not an HTML page.",
      };
    }
    const html = await response.text();
    return {
      ...blank,
      opened: true,
      statusCode: response.status,
      ...readPageSignals(html),
    };
  } catch (error) {
    const message =
      error instanceof UnsafeUrlError
        ? error.message
        : error instanceof Error && error.name === "AbortError"
          ? "The site did not respond in time."
          : "The site could not be reached.";
    return { ...blank, error: message };
  }
}

function checksFor(page: PageProbe): TechnicalRow[] {
  if (!page.opened || page.error) {
    return [
      {
        id: `${page.role}-open`,
        label: "Page opens",
        status: "needs_work",
        detail: page.error ?? "The page did not open.",
      },
      {
        id: `${page.role}-rest`,
        label: "Title, heading, canonical, and schema",
        status: "waiting",
        detail: "Checked only after the page opens as HTML.",
      },
    ];
  }

  return [
    row(`${page.role}-title`, "Title", Boolean(page.title), page.title ?? "No title element."),
    row(`${page.role}-heading`, "Heading", Boolean(page.heading), page.heading ?? "No h1 heading."),
    row(
      `${page.role}-answer`,
      "Direct answer",
      page.hasDirectAnswer,
      page.hasDirectAnswer
        ? "A description or opening paragraph is present."
        : "No description or opening paragraph of useful length.",
    ),
    row(
      `${page.role}-canonical`,
      "Canonical",
      Boolean(page.canonical),
      page.canonical ?? "No canonical link.",
    ),
    row(
      `${page.role}-schema`,
      "Schema",
      page.schemaTypes.length > 0,
      page.schemaTypes.length ? page.schemaTypes.join(", ") : "No schema.org type in the HTML.",
    ),
    row(
      `${page.role}-citation`,
      "Author or date",
      page.citationSignals.length > 0,
      page.citationSignals.length
        ? page.citationSignals.join(", ")
        : "No author, date, or article schema.",
    ),
  ];
}

function row(id: string, label: string, ok: boolean, detail: string): TechnicalRow {
  return { id, label, status: ok ? "pass" : "needs_work", detail };
}

function fixesFor(brand: (PageProbe & { checks: TechnicalRow[] }) | undefined): AuditFix[] {
  if (!brand) return [];
  const drafts: Array<{ title: string; why: string }> = [];
  if (!brand.opened || brand.error) {
    drafts.push({
      title: "Make the brand page open",
      why: brand.error ?? "The brand URL did not open, so the rest of the check did not run.",
    });
  } else {
    if (!brand.title) {
      drafts.push({
        title: "Add a page title",
        why: "The brand page opened without a title.",
      });
    }
    if (!brand.heading) {
      drafts.push({
        title: "Add a heading",
        why: "The brand page has no h1 a buyer can scan.",
      });
    }
    if (!brand.hasDirectAnswer) {
      drafts.push({
        title: "Add a direct answer",
        why: "The page has no description or opening paragraph long enough to answer the page.",
      });
    }
    if (!brand.canonical) {
      drafts.push({
        title: "Add a canonical URL",
        why: "The page does not name one canonical address.",
      });
    }
    if (brand.schemaTypes.length === 0) {
      drafts.push({
        title: "Add structured data",
        why: "The HTML has no schema.org type.",
      });
    }
    if (brand.citationSignals.length === 0) {
      drafts.push({
        title: "Add an author or a date",
        why: "The page does not show an author, a published date, or article schema.",
      });
    }
  }

  return drafts.slice(0, 5).map((draft, index) => ({
    rank: index + 1,
    title: draft.title,
    why: draft.why,
  }));
}

function citationSignalsFrom(html: string, schemaTypes: string[]) {
  const signals: string[] = [];
  if (metaContent(html, "name", "author") || metaContent(html, "property", "article:author")) {
    signals.push("author");
  }
  if (metaContent(html, "property", "article:published_time") || /<time\b/i.test(html)) {
    signals.push("date");
  }
  if (schemaTypes.some((type) => /FAQPage|Article|BlogPosting|NewsArticle/i.test(type))) {
    signals.push("article schema");
  }
  return signals;
}

function readSchemaTypes(html: string) {
  const types = new Set<string>();
  const blocks = html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks) {
    try {
      collectTypes(JSON.parse(block[1] ?? ""), types);
    } catch {
      // Broken JSON-LD is treated as absent rather than a pass.
    }
  }
  return [...types];
}

function collectTypes(value: unknown, types: Set<string>) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectTypes(item, types);
    return;
  }
  const record = value as Record<string, unknown>;
  const type = record["@type"];
  if (typeof type === "string") types.add(type);
  if (Array.isArray(type)) {
    for (const item of type) {
      if (typeof item === "string") types.add(item);
    }
  }
  if (record["@graph"]) collectTypes(record["@graph"], types);
}

function firstTag(html: string, tag: string) {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ?? null;
}

function textOf(value: string | null) {
  if (!value) return null;
  const text = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > 180 ? `${text.slice(0, 179).trimEnd()}…` : text;
}

function linkHref(html: string, rel: string) {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (!new RegExp(`\\brel=["']${rel}["']`, "i").test(tag)) continue;
    const href = attr(tag, "href");
    if (href) return href;
  }
  return null;
}

function metaContent(html: string, attrName: "name" | "property", value: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const found = attr(tag, attrName);
    if (found?.toLowerCase() !== value.toLowerCase()) continue;
    const content = attr(tag, "content");
    if (content) return content;
  }
  return null;
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match?.[2]?.trim() || null;
}
