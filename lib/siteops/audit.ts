import { safeFetch } from "@/lib/net/url-guard";
import type {
  AuditResult,
  ComparisonAuditDelta,
  ComparisonInsight,
  SiteOpsDownloads,
  SiteOpsComparisonReport,
  SiteOpsReport,
  SiteOpsScores,
  ScoreBand,
} from "@/lib/siteops/types";

const DEFAULT_WEIGHTS: Record<string, number> = {
  faq_schema: 1.5,
  direct_answer: 1.5,
  qa_density: 1.5,
  readability: 1,
  named_entities: 1,
  author_byline: 1,
  topical_depth: 1.3,
  trust_signals: 1.3,
  content_freshness: 1.2,
  external_links: 1,
  comparison_content: 1,
  citation_likelihood: 1.3,
};

type JsonLd = Record<string, unknown>;

type ParsedLink = {
  href: string;
  rel: string;
  text: string;
};

type AuditContext = {
  url: string;
  html: string;
  text: string;
  paragraphs: string[];
  headings: string[];
  links: ParsedLink[];
  jsonLd: JsonLd[];
  tablesCount: number;
  meta: Record<string, string>;
  authorSignals: string[];
  dates: Array<{ label: string; value: string }>;
};

export async function auditUrl(url: string): Promise<SiteOpsReport> {
  const normalizedUrl = normalizeUrl(url);
  const html = await fetchHtml(normalizedUrl);
  return buildSiteOpsReport(normalizedUrl, html);
}

export async function compareUrls(
  targetUrl: string,
  competitorUrl: string,
): Promise<SiteOpsComparisonReport> {
  const [target, competitor] = await Promise.all([
    auditUrl(targetUrl),
    auditUrl(competitorUrl),
  ]);

  return buildComparisonReport(target, competitor);
}

export function buildSiteOpsReport(url: string, html: string): SiteOpsReport {
  const ctx = parseHtml(url, html);
  const audits = withRecommendations(runAudits(ctx));
  const scores = computeScores(audits);

  return {
    url,
    timestamp: new Date().toISOString(),
    scores,
    audits,
    probe: {
      enabled: false,
      results: [],
    },
  };
}

export function createDownloads(report: SiteOpsReport): SiteOpsDownloads {
  return {
    json: JSON.stringify(report, null, 2),
    html: renderHtmlReport(report),
    csv: renderCsvReport(report),
  };
}

export function createComparisonDownloads(
  report: SiteOpsComparisonReport,
): SiteOpsDownloads {
  return {
    json: JSON.stringify(report, null, 2),
    html: renderHtmlComparisonReport(report),
    csv: renderCsvComparisonReport(report),
  };
}

export function buildComparisonReport(
  target: SiteOpsReport,
  competitor: SiteOpsReport,
): SiteOpsComparisonReport {
  return {
    type: "comparison",
    timestamp: new Date().toISOString(),
    target,
    competitor,
    comparison: buildComparisonSummary(target, competitor),
  };
}

function buildComparisonSummary(
  target: SiteOpsReport,
  competitor: SiteOpsReport,
) {
  const auditDeltas = target.audits.map((targetAudit) => {
    const competitorAudit = findAudit(competitor.audits, targetAudit.id);

    return {
      id: targetAudit.id,
      category: targetAudit.category,
      title: targetAudit.title,
      target_status: targetAudit.status,
      competitor_status: competitorAudit.status,
      target_score: targetAudit.score,
      competitor_score: competitorAudit.score,
      delta: targetAudit.score - competitorAudit.score,
    };
  });

  const targetAdvantages = auditDeltas
    .filter((audit) => audit.delta > 0)
    .sort((left, right) => rankAuditDelta(right, target) - rankAuditDelta(left, target));
  const competitorAdvantages = auditDeltas
    .filter((audit) => audit.delta < 0)
    .sort((left, right) => rankAuditDelta(right, target) - rankAuditDelta(left, target));

  return {
    scores: {
      composite: scoreDelta(target.scores.composite, competitor.scores.composite),
      aeo: scoreDelta(target.scores.aeo, competitor.scores.aeo),
      geo: scoreDelta(target.scores.geo, competitor.scores.geo),
    },
    leader: buildComparisonLeader(target, competitor),
    audit_deltas: auditDeltas,
    target_advantages: targetAdvantages,
    competitor_advantages: competitorAdvantages,
    competitor_edges: competitorAdvantages.map((audit) =>
      buildCompetitorEdge(audit, target),
    ),
    improve_first: buildImproveFirst(auditDeltas, target),
  };
}

function findAudit(audits: AuditResult[], id: string) {
  const audit = audits.find((candidate) => candidate.id === id);
  if (!audit) {
    throw new Error(`Competitor audit missing expected check: ${id}`);
  }
  return audit;
}

function scoreDelta(target: number, competitor: number) {
  return {
    target,
    competitor,
    delta: target - competitor,
  };
}

function buildComparisonLeader(
  target: SiteOpsReport,
  competitor: SiteOpsReport,
) {
  const delta = target.scores.composite - competitor.scores.composite;
  const scoreGap = Math.abs(delta);

  if (delta === 0) {
    return {
      role: "tie" as const,
      label: "Even match",
      score_gap: scoreGap,
      summary: `Both pages scored ${target.scores.composite}. Use the opportunities below to create a visible lead.`,
    };
  }

  if (delta > 0) {
    return {
      role: "target" as const,
      label: "Target leads",
      score_gap: scoreGap,
      summary: `Target leads by ${scoreGap} point${scoreGap === 1 ? "" : "s"}, but competitor gaps still show what to defend.`,
    };
  }

  return {
    role: "competitor" as const,
    label: "Competitor leads",
    score_gap: scoreGap,
    summary: `Competitor leads by ${scoreGap} point${scoreGap === 1 ? "" : "s"}. Prioritize the checks they pass and target misses.`,
  };
}

function buildCompetitorEdge(
  audit: ComparisonAuditDelta,
  target: SiteOpsReport,
): ComparisonInsight {
  const targetAudit = findAudit(target.audits, audit.id);
  const scoreImpact =
    targetAudit.recommendation?.score_impact ?? Math.round(targetAudit.weight * 10);

  return {
    id: audit.id,
    category: audit.category,
    title: audit.title,
    target_status: audit.target_status,
    competitor_status: audit.competitor_status,
    priority:
      targetAudit.recommendation?.priority ?? priorityFromImpact(scoreImpact),
    score_impact: scoreImpact,
    reason: `Competitor passes this check while the target is ${audit.target_status}.`,
    action:
      targetAudit.recommendation?.instruction ??
      `Match the competitor's coverage for ${audit.title.toLowerCase()}.`,
  };
}

function buildImproveFirst(
  auditDeltas: ComparisonAuditDelta[],
  target: SiteOpsReport,
): ComparisonInsight[] {
  const deltaById = new Map(auditDeltas.map((audit) => [audit.id, audit]));

  return target.audits
    .filter((audit) => audit.status !== "pass")
    .map((audit) => {
      const delta = deltaById.get(audit.id);
      const scoreImpact =
        audit.recommendation?.score_impact ?? Math.round(audit.weight * 10);
      const competitorHasEdge = delta?.competitor_status === "pass";

      return {
        id: audit.id,
        category: audit.category,
        title: audit.title,
        target_status: audit.status,
        competitor_status: delta?.competitor_status ?? "fail",
        priority: audit.recommendation?.priority ?? priorityFromImpact(scoreImpact),
        score_impact: scoreImpact,
        reason: competitorHasEdge
          ? "Competitor already passes this check, making it an immediate parity gap."
          : "High-impact target issue that can lift the report even without a competitor gap.",
        action:
          audit.recommendation?.instruction ??
          `Improve ${audit.title.toLowerCase()} to recover score and citation readiness.`,
      };
    })
    .sort((left, right) => insightRank(right) - insightRank(left))
    .slice(0, 5);
}

function rankAuditDelta(delta: ComparisonAuditDelta, target: SiteOpsReport) {
  const targetAudit = findAudit(target.audits, delta.id);
  const impact =
    targetAudit.recommendation?.score_impact ?? Math.round(targetAudit.weight * 10);
  return impact + Math.abs(delta.delta) * 100;
}

function insightRank(insight: ComparisonInsight) {
  const competitorEdgeBoost =
    insight.competitor_status === "pass" && insight.target_status !== "pass"
      ? 1000
      : 0;
  const priorityBoost =
    insight.priority === "high" ? 100 : insight.priority === "medium" ? 50 : 10;
  return competitorEdgeBoost + priorityBoost + insight.score_impact;
}

function priorityFromImpact(scoreImpact: number) {
  if (scoreImpact >= 13) return "high";
  if (scoreImpact >= 10) return "medium";
  return "low";
}

async function fetchHtml(url: string): Promise<string> {
  const response = await safeFetch(url, {
    timeoutMs: 20000,
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; CiteOpsPlayground/1.0; +https://www.npmjs.com/package/llm-citeops)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error(`Expected HTML but received "${contentType || "unknown"}"`);
  }

  return response.text();
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(candidate);
  return url.toString();
}

function parseHtml(url: string, html: string): AuditContext {
  const cleanedHtml = html
    .replace(/<script\b(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");

  const paragraphs = extractTagText(cleanedHtml, "p");
  const headings = [
    ...extractTagText(cleanedHtml, "h1"),
    ...extractTagText(cleanedHtml, "h2"),
    ...extractTagText(cleanedHtml, "h3"),
    ...extractTagText(cleanedHtml, "h4"),
  ];
  const links = extractLinks(cleanedHtml);
  const jsonLd = extractJsonLd(cleanedHtml);
  const meta = extractMeta(cleanedHtml);
  const text = stripHtml(cleanedHtml);
  const dates = extractDates(cleanedHtml, meta, jsonLd);
  const authorSignals = extractAuthorSignals(cleanedHtml, meta, jsonLd);

  return {
    url,
    html: cleanedHtml,
    text,
    paragraphs,
    headings,
    links,
    jsonLd,
    tablesCount: countMatches(cleanedHtml, /<table\b/gi),
    meta,
    authorSignals,
    dates,
  };
}

function runAudits(ctx: AuditContext): AuditResult[] {
  return [
    auditFaqSchema(ctx),
    auditDirectAnswer(ctx),
    auditQaDensity(ctx),
    auditReadability(ctx),
    auditNamedEntities(ctx),
    auditAuthorByline(ctx),
    auditTopicalDepth(ctx),
    auditTrustSignals(ctx),
    auditContentFreshness(ctx),
    auditExternalLinks(ctx),
    auditComparisonContent(ctx),
    auditCitationLikelihood(ctx),
  ];
}

function auditFaqSchema(ctx: AuditContext): AuditResult {
  const matched = ctx.jsonLd.find((block) => {
    const types = arrayify(block["@type"]).map(String);
    return types.some((type) => type === "FAQPage" || type === "HowTo");
  });
  const foundType = matched ? arrayify(matched["@type"]).map(String)[0] : "";

  return {
    id: "faq_schema",
    category: "aeo",
    title: "FAQ / HowTo schema present",
    status: matched ? "pass" : "fail",
    weight: 1.5,
    score: matched ? 1 : 0,
    evidence: matched
      ? `Found JSON-LD with @type "${foundType}" in the page source.`
      : 'No JSON-LD block with @type "FAQPage" or "HowTo" was found.',
  };
}

function auditDirectAnswer(ctx: AuditContext): AuditResult {
  const firstParagraph = ctx.paragraphs[0]?.trim() ?? "";

  if (!firstParagraph) {
    return {
      id: "direct_answer",
      category: "aeo",
      title: "Direct answer in first paragraph",
      status: "fail",
      weight: 1.5,
      score: 0,
      evidence: "No paragraph content found on the page.",
    };
  }

  const sentences = firstParagraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
  const hasDirectAnswer = sentences.some(
    (sentence) =>
      !sentence.endsWith("?") &&
      sentence.length >= 30 &&
      !/^(click|read|scroll|learn|find|see|check|welcome|this (page|article|guide|post))/i.test(
        sentence,
      ),
  );
  const snippet =
    firstParagraph.length > 150
      ? `${firstParagraph.slice(0, 150)}...`
      : firstParagraph;

  return {
    id: "direct_answer",
    category: "aeo",
    title: "Direct answer in first paragraph",
    status: hasDirectAnswer ? "pass" : "fail",
    weight: 1.5,
    score: hasDirectAnswer ? 1 : 0,
    evidence: hasDirectAnswer
      ? `First paragraph opens with a direct statement: "${snippet}"`
      : `First paragraph does not begin with a clear factual answer: "${snippet}"`,
  };
}

function auditQaDensity(ctx: AuditContext): AuditResult {
  const words = tokenizeWords(ctx.text);
  if (words.length < 50) {
    return {
      id: "qa_density",
      category: "aeo",
      title: "Q&A density (questions per 500 words)",
      status: "fail",
      weight: 1.5,
      score: 0,
      evidence: `Page has too little content (${words.length} words) to evaluate Q&A density.`,
    };
  }

  const questionCount = (ctx.text.match(/\?/g) ?? []).length;
  const per500 = (questionCount / words.length) * 500;
  const passes = per500 >= 2;

  return {
    id: "qa_density",
    category: "aeo",
    title: "Q&A density (questions per 500 words)",
    status: passes ? "pass" : "fail",
    weight: 1.5,
    score: passes ? 1 : 0,
    evidence: passes
      ? `Found ${questionCount} questions across ${words.length} words (${per500.toFixed(1)} per 500 words).`
      : `Only ${questionCount} question(s) across ${words.length} words (${per500.toFixed(1)} per 500 words). Target is at least 2.`,
  };
}

function auditReadability(ctx: AuditContext): AuditResult {
  const text = ctx.text.replace(/\s+/g, " ").trim();
  const sentences = text
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.split(/\s+/).length >= 3);
  const words = tokenizeWords(text);

  if (sentences.length < 3 || words.length < 30) {
    return {
      id: "readability",
      category: "aeo",
      title: "Readability grade <= 10",
      status: "warn",
      weight: 1,
      score: 0,
      evidence: "Not enough content to calculate readability grade reliably.",
    };
  }

  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;
  const grade = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  const roundedGrade = Math.round(grade * 10) / 10;
  const passes = roundedGrade <= 10;

  return {
    id: "readability",
    category: "aeo",
    title: "Readability grade <= 10",
    status: passes ? "pass" : "fail",
    weight: 1,
    score: passes ? 1 : 0,
    evidence: passes
      ? `Flesch-Kincaid grade level is ${roundedGrade} with ${avgWordsPerSentence.toFixed(1)} words per sentence.`
      : `Flesch-Kincaid grade level is ${roundedGrade}; simplify long sentences to get to 10 or below.`,
  };
}

function auditNamedEntities(ctx: AuditContext): AuditResult {
  const people = uniqueMatches(ctx.text, /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g);
  const organizations = uniqueMatches(
    ctx.text,
    /\b[A-Z][A-Za-z&.-]+(?: [A-Z][A-Za-z&.-]+)* (?:Inc|LLC|Ltd|Corporation|Corp|Company|University|Institute|Labs|Lab|Agency|Group)\b/g,
  );
  const places = uniqueMatches(
    ctx.text,
    /\b(?:in|at|from|across) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)\b/g,
    1,
  );

  const typeCount = [people.length, organizations.length, places.length].filter(
    (count) => count > 0,
  ).length;
  const passes = typeCount >= 2;
  const found = [
    people.length ? `People: ${people.slice(0, 3).join(", ")}` : "",
    organizations.length
      ? `Organizations: ${organizations.slice(0, 3).join(", ")}`
      : "",
    places.length ? `Places: ${places.slice(0, 3).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    id: "named_entities",
    category: "aeo",
    title: "Named entity coverage",
    status: passes ? "pass" : "fail",
    weight: 1,
    score: passes ? 1 : 0,
    evidence: passes
      ? `Detected entities across ${typeCount} categories. ${found}`
      : `Weak named entity coverage. ${found || "No meaningful person, organization, or place entities were detected."}`,
  };
}

function auditAuthorByline(ctx: AuditContext): AuditResult {
  const found = ctx.authorSignals.length > 0;
  return {
    id: "author_byline",
    category: "aeo",
    title: "Author byline + credentials present",
    status: found ? "pass" : "fail",
    weight: 1,
    score: found ? 1 : 0,
    evidence: found
      ? ctx.authorSignals.join("; ")
      : 'No author byline found. Missing common author markers such as `rel="author"`, `itemprop="author"`, JSON-LD author fields, or `<meta name="author">`.',
  };
}

function auditTopicalDepth(ctx: AuditContext): AuditResult {
  const topTerms = computeTopTerms(ctx.text).slice(0, 10);
  if (topTerms.length < 3) {
    return {
      id: "topical_depth",
      category: "geo",
      title: "Topical depth score (subtopic coverage)",
      status: "fail",
      weight: 1.3,
      score: 0,
      evidence: "Not enough content to compute topical depth.",
    };
  }

  const headingText = ctx.headings.join(" ").toLowerCase();
  const coveredTerms = topTerms.filter((term) => headingText.includes(term));
  const coverageRatio = coveredTerms.length / topTerms.length;
  const passes = coverageRatio >= 0.6;
  const uncoveredTerms = topTerms.filter((term) => !coveredTerms.includes(term));

  return {
    id: "topical_depth",
    category: "geo",
    title: "Topical depth score (subtopic coverage)",
    status: passes ? "pass" : "fail",
    weight: 1.3,
    score: passes ? 1 : 0,
    evidence: passes
      ? `${coveredTerms.length}/${topTerms.length} top terms appear in headings.`
      : `Only ${coveredTerms.length}/${topTerms.length} top terms appear in headings. Missing likely subtopics: ${uncoveredTerms.slice(0, 5).join(", ")}.`,
  };
}

function auditTrustSignals(ctx: AuditContext): AuditResult {
  const signals: string[] = [];
  const missing: string[] = [];
  const externalLinks = getExternalLinks(ctx.links, ctx.url);

  if (ctx.authorSignals.length) {
    signals.push("author");
  } else {
    missing.push("author");
  }

  const hasPublisher = ctx.jsonLd.some(
    (block) =>
      typeof block.publisher === "object" ||
      typeof block.sourceOrganization === "object" ||
      block["@type"] === "Organization",
  );
  if (hasPublisher) {
    signals.push("publisher/organization");
  } else {
    missing.push("publisher");
  }

  const hasCitationSchema = ctx.jsonLd.some((block) => Boolean(block.citation));
  if (hasCitationSchema) {
    signals.push("citation schema");
  } else {
    missing.push("citation schema");
  }

  const hasAboutSchema = ctx.jsonLd.some((block) => Boolean(block.about));
  if (hasAboutSchema) {
    signals.push("about/topic schema");
  }

  if (externalLinks.length >= 2) {
    signals.push(`${externalLinks.length} external sources`);
  } else {
    missing.push("external source links");
  }

  if (ctx.dates.length > 0) {
    signals.push("publication date");
  } else {
    missing.push("publication date");
  }

  const passes = signals.length >= 3;
  return {
    id: "trust_signals",
    category: "geo",
    title: "Trust signals (EEAT)",
    status: passes ? "pass" : "fail",
    weight: 1.3,
    score: passes ? 1 : 0,
    evidence: passes
      ? `${signals.length} trust signals found: ${signals.join(", ")}.`
      : `Only ${signals.length} trust signal(s) found. Missing: ${missing.join(", ")}.`,
  };
}

function auditContentFreshness(ctx: AuditContext): AuditResult {
  if (ctx.dates.length === 0) {
    return {
      id: "content_freshness",
      category: "geo",
      title: "Content freshness (publish / modified date)",
      status: "fail",
      weight: 1.2,
      score: 0,
      evidence: "No publication or modification date was found.",
    };
  }

  const parsedDates = ctx.dates
    .map((item) => ({ ...item, parsed: safeDate(item.value) }))
    .filter((item): item is { label: string; value: string; parsed: Date } =>
      Boolean(item.parsed),
    );

  if (parsedDates.length === 0) {
    return {
      id: "content_freshness",
      category: "geo",
      title: "Content freshness (publish / modified date)",
      status: "fail",
      weight: 1.2,
      score: 0,
      evidence: `Date fields were found but could not be parsed: ${ctx.dates.map((item) => item.value).join(", ")}`,
    };
  }

  const newest = parsedDates.sort(
    (left, right) => right.parsed.getTime() - left.parsed.getTime(),
  )[0];
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const monthsOld = Math.round(
    (Date.now() - newest.parsed.getTime()) / (1000 * 60 * 60 * 24 * 30),
  );
  const isFresh = newest.parsed >= twelveMonthsAgo;

  return {
    id: "content_freshness",
    category: "geo",
    title: "Content freshness (publish / modified date)",
    status: isFresh ? "pass" : "fail",
    weight: 1.2,
    score: isFresh ? 1 : 0,
    evidence: isFresh
      ? `Newest date found: ${newest.label} (${monthsOld} month(s) ago).`
      : `Newest date found: ${newest.label} (${monthsOld} month(s) ago). Target is 12 months or fresher.`,
  };
}

function auditExternalLinks(ctx: AuditContext): AuditResult {
  const allExternalLinks = getExternalLinks(ctx.links, ctx.url);
  const followLinks = allExternalLinks.filter(
    (link) => !link.rel.toLowerCase().includes("nofollow"),
  );
  const passes = followLinks.length >= 2;
  const examples = followLinks
    .slice(0, 3)
    .map((link) => `${link.text || link.href} (${link.href})`)
    .join(", ");

  return {
    id: "external_links",
    category: "geo",
    title: "External citation / link quality",
    status: passes ? "pass" : "fail",
    weight: 1,
    score: passes ? 1 : 0,
    evidence: passes
      ? `${followLinks.length} qualifying external link(s) found. Examples: ${examples}`
      : `Only ${followLinks.length} qualifying external link(s) found. Add authoritative external citations.`,
  };
}

function auditComparisonContent(ctx: AuditContext): AuditResult {
  const patterns = [
    /\bvs\.?\b/i,
    /\bversus\b/i,
    /\bcompared?\s+to\b/i,
    /\bcomparison\b/i,
    /\balternatives?\b/i,
    /\bbest\s+\w+\b/i,
    /\btop\s+\d+\b/i,
    /\bpros?\s+(and|&|vs)\s+cons?\b/i,
    /\bdifference[s]?\s+between\b/i,
    /\bwhich\s+(is\s+)?(better|best)\b/i,
  ];
  const matchedHeading = ctx.headings.find((heading) =>
    patterns.some((pattern) => pattern.test(heading)),
  );
  const passes = Boolean(matchedHeading) || ctx.tablesCount > 0;

  return {
    id: "comparison_content",
    category: "geo",
    title: "Comparison content present",
    status: passes ? "pass" : "fail",
    weight: 1,
    score: passes ? 1 : 0,
    evidence: passes
      ? `Comparison signals detected${matchedHeading ? ` in heading "${matchedHeading}"` : ""}${ctx.tablesCount > 0 ? `${matchedHeading ? " and" : ""} through table content` : ""}.`
      : 'No comparison-oriented content was found. Add headings such as "vs", "alternatives", or a comparison table.',
  };
}

function auditCitationLikelihood(ctx: AuditContext): AuditResult {
  const signals: string[] = [];
  const missing: string[] = [];
  const externalLinks = getExternalLinks(ctx.links, ctx.url);

  if (ctx.jsonLd.length > 0) {
    signals.push("structured schema");
  } else {
    missing.push("JSON-LD schema");
  }

  if (ctx.authorSignals.length > 0) {
    signals.push("author byline");
  } else {
    missing.push("author byline");
  }

  const hasFaq = ctx.jsonLd.some((block) =>
    arrayify(block["@type"])
      .map(String)
      .some((type) => type === "FAQPage" || type === "HowTo"),
  );
  if (hasFaq) {
    signals.push("FAQ/HowTo schema");
  } else {
    missing.push("FAQ/HowTo schema");
  }

  if (externalLinks.length >= 3) {
    signals.push(`${externalLinks.length} external citations`);
  } else {
    missing.push(`3+ external citations (found ${externalLinks.length})`);
  }

  const structureCount = ctx.headings.filter((heading) => /^.{1,120}$/.test(heading))
    .length;
  if (structureCount >= 3) {
    signals.push("well-structured headings");
  } else {
    missing.push("3+ H2/H3 headings");
  }

  const passes = signals.length >= 3;
  return {
    id: "citation_likelihood",
    category: "geo",
    title: "Citation likelihood signals",
    status: passes ? "pass" : "fail",
    weight: 1.3,
    score: passes ? 1 : 0,
    evidence: passes
      ? `${signals.length}/5 citation signals present: ${signals.join(", ")}.`
      : `Only ${signals.length}/5 citation signals present. Missing: ${missing.join("; ")}.`,
  };
}

function withRecommendations(audits: AuditResult[]): AuditResult[] {
  return audits.map((audit) => {
    if (audit.status === "pass") {
      return audit;
    }

    const scoreImpact = Math.round(audit.weight * 5);
    const priority: "high" | "medium" | "low" =
      audit.weight >= 1.3 ? "high" : audit.weight >= 1 ? "medium" : "low";

    const recommendation = getRecommendation(audit.id, priority, scoreImpact);
    return recommendation ? { ...audit, recommendation } : audit;
  });
}

function getRecommendation(
  auditId: string,
  priority: "high" | "medium" | "low",
  scoreImpact: number,
) {
  const recommendations: Record<
    string,
    {
      instruction: string;
      code_snippet?: string;
    }
  > = {
    faq_schema: {
      instruction:
        "Add FAQPage or HowTo JSON-LD to make the page easier for answer engines to extract and cite.",
      code_snippet: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What problem does this page solve?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Provide a concise factual answer here."
      }
    }
  ]
}
</script>`,
    },
    direct_answer: {
      instruction:
        "Rewrite the opening paragraph so it directly answers the main search question in the first 2 to 3 sentences.",
    },
    qa_density: {
      instruction:
        "Add question-led sections and FAQ-style headings so the content maps better to answer-engine prompts.",
    },
    readability: {
      instruction:
        "Shorten long sentences, remove jargon, and target an easier reading grade for broader model extraction.",
    },
    named_entities: {
      instruction:
        "Mention relevant people, organizations, and places to strengthen topical specificity and attribution.",
    },
    author_byline: {
      instruction:
        "Add an author byline with role, credentials, and organization signals in both visible copy and schema.",
    },
    topical_depth: {
      instruction:
        "Expand headings to cover missing subtopics that appear repeatedly in the page body but not in section titles.",
    },
    trust_signals: {
      instruction:
        "Add author, publisher, source citations, and clear date metadata to strengthen EEAT signals.",
    },
    content_freshness: {
      instruction:
        "Publish `dateModified` and visible update timestamps so models can assess recency confidently.",
    },
    external_links: {
      instruction:
        "Add at least two authoritative external links that support factual claims without `nofollow` when appropriate.",
    },
    comparison_content: {
      instruction:
        "Add a comparison section with alternatives, pros/cons, or a side-by-side table for competitive queries.",
    },
    citation_likelihood: {
      instruction:
        "Improve structured data, authorship, headings, and external citations to raise citation readiness overall.",
    },
  };

  const selected = recommendations[auditId];
  if (!selected) {
    return undefined;
  }

  return {
    priority,
    score_impact: scoreImpact,
    instruction: selected.instruction,
    code_snippet: selected.code_snippet,
  };
}

function computeScores(audits: AuditResult[]): SiteOpsScores {
  const aeo = weightedAverage(audits.filter((audit) => audit.category === "aeo"));
  const geo = weightedAverage(audits.filter((audit) => audit.category === "geo"));
  const aeoScore = Math.round(aeo * 100);
  const geoScore = Math.round(geo * 100);
  const composite = Math.round((aeo + geo) * 50);

  return {
    aeo: aeoScore,
    geo: geoScore,
    composite,
    band: scoreBand(composite),
    percentile: null,
  };
}

function weightedAverage(audits: AuditResult[]) {
  if (audits.length === 0) {
    return 0;
  }

  const weighted = audits.reduce(
    (acc, audit) => {
      const weight = DEFAULT_WEIGHTS[audit.id] ?? audit.weight ?? 1;
      return {
        score: acc.score + audit.score * weight,
        weight: acc.weight + weight,
      };
    },
    { score: 0, weight: 0 },
  );

  return weighted.weight > 0 ? weighted.score / weighted.weight : 0;
}

function scoreBand(score: number): ScoreBand {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 50) return "needs-improvement";
  return "poor";
}

function renderHtmlReport(report: SiteOpsReport) {
  const failingAudits = report.audits.filter((audit) => audit.status !== "pass");
  const passingAudits = report.audits.filter((audit) => audit.status === "pass");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CiteOps Playground Report</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; background: #faf8f5; color: #1a1a1a; }
      main { max-width: 960px; margin: 0 auto; padding: 40px 20px 80px; }
      .card { background: #fff; border: 1px solid #e8e2d9; border-radius: 18px; padding: 24px; margin-top: 20px; }
      .scores { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; }
      .score { background: #fffdfa; border-radius: 14px; padding: 18px; border: 1px solid #e8e2d9; }
      .eyebrow { text-transform: uppercase; letter-spacing: .08em; font-size: 12px; color: #6b6560; }
      .value { font-size: 36px; font-weight: 700; margin-top: 8px; }
      .audit { padding: 16px 0; border-top: 1px solid #eee3d8; }
      .audit:first-child { border-top: 0; padding-top: 0; }
      .status { display: inline-block; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
      .pass { background: #e9f7ee; color: #157347; }
      .fail { background: #fde8e6; color: #b42318; }
      .warn { background: #fff4d8; color: #935f00; }
      pre { background: #1a1a1a; color: #fffaf8; padding: 14px; border-radius: 12px; overflow-x: auto; }
    </style>
  </head>
  <body>
    <main>
      <h1>CiteOps Playground Report</h1>
      <p>URL: ${escapeHtml(report.url)}</p>
      <p>Generated: ${escapeHtml(new Date(report.timestamp).toLocaleString())}</p>

      <section class="card">
        <div class="scores">
          <div class="score"><div class="eyebrow">Composite</div><div class="value">${report.scores.composite}</div></div>
          <div class="score"><div class="eyebrow">AEO</div><div class="value">${report.scores.aeo}</div></div>
          <div class="score"><div class="eyebrow">GEO</div><div class="value">${report.scores.geo}</div></div>
        </div>
      </section>

      <section class="card">
        <h2>Highest impact fixes</h2>
        ${failingAudits
          .sort(
            (left, right) =>
              (right.recommendation?.score_impact ?? 0) -
              (left.recommendation?.score_impact ?? 0),
          )
          .map(
            (audit) => `<div class="audit">
              <span class="status ${audit.status}">${audit.status}</span>
              <h3>${escapeHtml(audit.title)}</h3>
              <p>${escapeHtml(audit.evidence)}</p>
              ${
                audit.recommendation
                  ? `<p><strong>Recommendation:</strong> ${escapeHtml(audit.recommendation.instruction)}</p>`
                  : ""
              }
              ${
                audit.recommendation?.code_snippet
                  ? `<pre>${escapeHtml(audit.recommendation.code_snippet)}</pre>`
                  : ""
              }
            </div>`,
          )
          .join("")}
      </section>

      <section class="card">
        <h2>Passing checks</h2>
        ${passingAudits
          .map(
            (audit) => `<div class="audit">
              <span class="status ${audit.status}">${audit.status}</span>
              <h3>${escapeHtml(audit.title)}</h3>
              <p>${escapeHtml(audit.evidence)}</p>
            </div>`,
          )
          .join("")}
      </section>
    </main>
  </body>
</html>`;
}

function renderCsvReport(report: SiteOpsReport) {
  const passCount = report.audits.filter((audit) => audit.status === "pass").length;
  const failCount = report.audits.filter((audit) => audit.status === "fail").length;
  const warnCount = report.audits.filter((audit) => audit.status === "warn").length;

  return [
    "url,timestamp,composite,aeo,geo,band,pass_count,fail_count,warn_count",
    [
      csvEscape(report.url),
      csvEscape(report.timestamp),
      String(report.scores.composite),
      String(report.scores.aeo),
      String(report.scores.geo),
      csvEscape(report.scores.band),
      String(passCount),
      String(failCount),
      String(warnCount),
    ].join(","),
  ].join("\n");
}

function renderHtmlComparisonReport(report: SiteOpsComparisonReport) {
  const { target, competitor, comparison } = report;
  const topRows = comparison.audit_deltas
    .filter((audit) => audit.delta !== 0)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 8);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CiteOps Competitor Comparison</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; background: #faf8f5; color: #1a1a1a; }
      main { max-width: 1080px; margin: 0 auto; padding: 40px 20px 80px; }
      a { color: #426a5a; }
      .card { background: #fff; border: 1px solid #e8e2d9; border-radius: 18px; padding: 24px; margin-top: 20px; }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; }
      .split { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; }
      .score { background: #fffdfa; border-radius: 14px; padding: 18px; border: 1px solid #e8e2d9; }
      .eyebrow { text-transform: uppercase; letter-spacing: .08em; font-size: 12px; color: #6b6560; }
      .value { font-size: 36px; font-weight: 700; margin-top: 8px; }
      .delta { display: inline-block; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; }
      .positive { background: #e9f7ee; color: #157347; }
      .negative { background: #fde8e6; color: #b42318; }
      .neutral { background: #fff4d8; color: #935f00; }
      .insight { border-top: 1px solid #eee3d8; padding: 16px 0; }
      .insight:first-child { border-top: 0; padding-top: 0; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border-top: 1px solid #eee3d8; padding: 12px; text-align: left; vertical-align: top; }
      th { color: #6b6560; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
      @media (max-width: 760px) { .grid, .split { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Competitor comparison</p>
      <h1>${escapeHtml(comparison.leader.label)}</h1>
      <p>${escapeHtml(comparison.leader.summary)}</p>
      <p>Generated: ${escapeHtml(new Date(report.timestamp).toLocaleString())}</p>

      <section class="card split">
        <div>
          <p class="eyebrow">Target</p>
          <h2>${escapeHtml(target.url)}</h2>
        </div>
        <div>
          <p class="eyebrow">Competitor</p>
          <h2>${escapeHtml(competitor.url)}</h2>
        </div>
      </section>

      <section class="card grid">
        ${renderComparisonScoreCard("Composite", comparison.scores.composite)}
        ${renderComparisonScoreCard("AEO", comparison.scores.aeo)}
        ${renderComparisonScoreCard("GEO", comparison.scores.geo)}
      </section>

      <section class="card split">
        <div>
          <h2>Improve first</h2>
          ${renderComparisonInsights(comparison.improve_first)}
        </div>
        <div>
          <h2>Competitor edge</h2>
          ${renderComparisonInsights(comparison.competitor_edges)}
        </div>
      </section>

      <section class="card">
        <h2>Largest check deltas</h2>
        <table>
          <thead>
            <tr>
              <th>Check</th>
              <th>Target</th>
              <th>Competitor</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>
            ${topRows
              .map(
                (audit) => `<tr>
                  <td>${escapeHtml(audit.title)}</td>
                  <td>${escapeHtml(audit.target_status)}</td>
                  <td>${escapeHtml(audit.competitor_status)}</td>
                  <td>${escapeHtml(formatDelta(audit.delta))}</td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </section>
    </main>
  </body>
</html>`;
}

function renderComparisonScoreCard(
  label: string,
  score: SiteOpsComparisonReport["comparison"]["scores"]["composite"],
) {
  return `<div class="score">
    <div class="eyebrow">${escapeHtml(label)}</div>
    <div class="value">${score.target} vs ${score.competitor}</div>
    <span class="delta ${deltaTone(score.delta)}">${escapeHtml(formatDelta(score.delta))}</span>
  </div>`;
}

function renderComparisonInsights(insights: ComparisonInsight[]) {
  if (insights.length === 0) {
    return "<p>No priority gaps found for this section.</p>";
  }

  return insights
    .slice(0, 5)
    .map(
      (insight) => `<div class="insight">
        <p class="eyebrow">${escapeHtml(insight.priority)} priority - +${insight.score_impact} impact</p>
        <h3>${escapeHtml(insight.title)}</h3>
        <p>${escapeHtml(insight.reason)}</p>
        <p>${escapeHtml(insight.action)}</p>
      </div>`,
    )
    .join("");
}

function renderCsvComparisonReport(report: SiteOpsComparisonReport) {
  const headers = [
    "role",
    "url",
    "timestamp",
    "composite",
    "aeo",
    "geo",
    "band",
    "pass_count",
    "fail_count",
    "warn_count",
    "composite_delta_vs_other",
    "aeo_delta_vs_other",
    "geo_delta_vs_other",
  ];
  const { composite, aeo, geo } = report.comparison.scores;
  const rows = [
    comparisonCsvRow("target", report.target, composite.delta, aeo.delta, geo.delta),
    comparisonCsvRow(
      "competitor",
      report.competitor,
      -composite.delta,
      -aeo.delta,
      -geo.delta,
    ),
  ];

  return [headers.join(","), ...rows].join("\n");
}

function comparisonCsvRow(
  role: string,
  report: SiteOpsReport,
  compositeDelta: number,
  aeoDelta: number,
  geoDelta: number,
) {
  const passCount = report.audits.filter((audit) => audit.status === "pass").length;
  const failCount = report.audits.filter((audit) => audit.status === "fail").length;
  const warnCount = report.audits.filter((audit) => audit.status === "warn").length;

  return [
    role,
    csvEscape(report.url),
    csvEscape(report.timestamp),
    String(report.scores.composite),
    String(report.scores.aeo),
    String(report.scores.geo),
    csvEscape(report.scores.band),
    String(passCount),
    String(failCount),
    String(warnCount),
    String(compositeDelta),
    String(aeoDelta),
    String(geoDelta),
  ].join(",");
}

function formatDelta(delta: number) {
  return delta > 0 ? `+${delta}` : String(delta);
}

function deltaTone(delta: number) {
  if (delta > 0) return "positive";
  if (delta < 0) return "negative";
  return "neutral";
}

function extractTagText(html: string, tag: string) {
  const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const matches: string[] = [];
  for (const match of html.matchAll(regex)) {
    const value = stripHtml(match[1] ?? "");
    if (value) {
      matches.push(value);
    }
  }
  return matches;
}

function extractJsonLd(html: string): JsonLd[] {
  const regex =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks: JsonLd[] = [];

  for (const match of html.matchAll(regex)) {
    const raw = decodeEntities((match[1] ?? "").trim());
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object") {
            blocks.push(item);
          }
        }
      } else if (parsed && typeof parsed === "object") {
        blocks.push(parsed);
      }
    } catch {
      continue;
    }
  }

  return blocks;
}

function extractMeta(html: string) {
  const regex = /<meta\b[^>]*(?:name|property)=["']([^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>/gi;
  const meta: Record<string, string> = {};
  for (const match of html.matchAll(regex)) {
    meta[(match[1] ?? "").toLowerCase()] = decodeEntities(match[2] ?? "");
  }
  return meta;
}

function extractLinks(html: string): ParsedLink[] {
  const regex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const links: ParsedLink[] = [];

  for (const match of html.matchAll(regex)) {
    const attrs = match[1] ?? "";
    const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1] ?? "";
    if (!href) continue;
    const rel = attrs.match(/\brel=["']([^"']+)["']/i)?.[1] ?? "";
    const text = stripHtml(match[2] ?? "");
    links.push({ href: decodeEntities(href), rel: decodeEntities(rel), text });
  }

  return links;
}

function extractAuthorSignals(
  html: string,
  meta: Record<string, string>,
  jsonLd: JsonLd[],
) {
  const signals: string[] = [];

  if (/\brel=["']author["']/i.test(html) || /\bitemprop=["']author["']/i.test(html)) {
    signals.push("HTML author attribute detected");
  }
  if (/\b(class|id)=["'][^"']*author[^"']*["']/i.test(html)) {
    signals.push("Author CSS marker detected");
  }
  if (meta.author) {
    signals.push(`Meta author: "${meta.author}"`);
  }

  for (const block of jsonLd) {
    const author = block.author;
    if (typeof author === "string") {
      signals.push(`JSON-LD author: "${author}"`);
      break;
    }
    if (author && typeof author === "object" && "name" in author) {
      signals.push(`JSON-LD author: "${String(author.name)}"`);
      break;
    }
  }

  return [...new Set(signals)];
}

function extractDates(
  html: string,
  meta: Record<string, string>,
  jsonLd: JsonLd[],
) {
  const dates: Array<{ label: string; value: string }> = [];

  const maybePush = (label: string, value?: string) => {
    if (value) {
      dates.push({ label, value });
    }
  };

  maybePush("article:modified_time", meta["article:modified_time"]);
  maybePush("article:published_time", meta["article:published_time"]);
  maybePush("meta[name=date]", meta.date);
  maybePush(
    "<time datetime>",
    html.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)?.[1],
  );

  for (const block of jsonLd) {
    if (typeof block.dateModified === "string") {
      maybePush("JSON-LD dateModified", block.dateModified);
    }
    if (typeof block.datePublished === "string") {
      maybePush("JSON-LD datePublished", block.datePublished);
    }
  }

  return dates;
}

function stripHtml(html: string) {
  return decodeEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function tokenizeWords(text: string) {
  return text.split(/\s+/).filter((word) => /[a-zA-Z]/.test(word));
}

function countSyllables(word: string) {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  if (cleaned.length === 0) return 0;
  if (cleaned.length <= 3) return 1;
  const vowelGroups = cleaned
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, vowelGroups?.length ?? 1);
}

function computeTopTerms(text: string) {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "with",
    "from",
    "that",
    "this",
    "these",
    "those",
    "your",
    "their",
    "there",
    "have",
    "will",
    "about",
    "into",
    "when",
    "where",
    "which",
    "what",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));
  const frequency = new Map<string, number>();

  for (const word of words) {
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }

  return [...frequency.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 20)
    .map(([word]) => word);
}

function getExternalLinks(links: ParsedLink[], currentUrl: string) {
  const currentDomain = safeHostname(currentUrl);
  return links.filter((link) => {
    if (!/^https?:\/\//i.test(link.href)) {
      return false;
    }

    const linkDomain = safeHostname(link.href);
    return Boolean(linkDomain) && linkDomain !== currentDomain;
  });
}

function safeHostname(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function safeDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function arrayify(value: unknown) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function uniqueMatches(text: string, regex: RegExp, captureGroup?: number) {
  const values = new Set<string>();

  for (const match of text.matchAll(regex)) {
    const value = (captureGroup ? match[captureGroup] : match[0])?.trim();
    if (value && value.length > 2) {
      values.add(value);
    }
  }

  return [...values];
}

function countMatches(text: string, regex: RegExp) {
  return [...text.matchAll(regex)].length;
}

function csvEscape(value: string) {
  if (/[,"\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
