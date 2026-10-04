export type DiscoveredCompetitor = {
  name: string;
  url: string | null;
};

export type Discovery = {
  domain: string;
  brandUrl: string;
  brandName: string;
  description: string | null;
  prompts: string[];
  competitors: DiscoveredCompetitor[];
  competitorNote: string;
};

const NAV = new Set([
  "personal",
  "business",
  "support",
  "about us",
  "about",
  "mobile",
  "devices",
  "plans",
  "fibre",
  "fiber",
  "broadband",
  "rewards",
  "services",
  "promotions",
  "login",
  "log in",
  "sign in",
  "sign up",
  "cart",
  "menu",
  "search",
  "home",
  "contact",
  "contact us",
  "bills",
  "account",
  "account services",
  "edit profile",
  "copyright",
  "copyright notices",
  "terms of use",
  "terms and conditions",
  "data protection",
  "store locator",
  "tv guide",
  "add-ons",
  "payment methods",
  "lifestyle",
  "insurance",
  "privacy",
  "cookie policy",
  "careers",
]);

const NAME_STOP = new Set([
  "a",
  "an",
  "the",
  "our",
  "your",
  "this",
  "that",
  "these",
  "those",
  "physical",
  "phone",
  "plan",
  "plans",
  "sim",
  "esim",
  "contract",
  "home",
  "mobile",
  "broadband",
  "fibre",
  "fiber",
  "best",
  "more",
  "new",
  "free",
  "online",
  "compare",
  "comparison",
  "alternative",
  "alternatives",
  "versus",
  "vs",
]);

export function discoverFromHtml(html: string, pageUrl: string): Omit<Discovery, "domain"> {
  const brandUrl = pageUrl;
  const hostname = hostnameOf(pageUrl);
  const brandName = brandNameFrom(html, hostname);
  const description = metaContent(html, "description");
  const text = unescapeHtml(unescapeHtml(html));
  const prompts = selectPrompts(html, text, brandName);
  const competitors = selectCompetitors(html, text, pageUrl, brandName);
  return {
    brandUrl,
    brandName,
    description,
    prompts,
    competitors,
    competitorNote: competitors.length
      ? "These competitors were named on the public site."
      : "No competitor was found on the site.",
  };
}

export function selectPrompts(html: string, unescaped: string, brandName: string) {
  const seen = new Set<string>();
  const ranked: Array<{ text: string; score: number; index: number }> = [];
  const push = (value: string | null) => {
    const text = cleanLine(value);
    if (!text) return;
    const key = text.toLocaleLowerCase();
    if (seen.has(key)) return;
    if (key === brandName.toLocaleLowerCase()) return;
    if (isNav(text)) return;
    const score = promptScore(text);
    if (score <= 0) return;
    seen.add(key);
    ranked.push({ text, score, index: ranked.length });
  };

  for (const tag of ["h1", "h2", "h3"]) {
    for (const heading of headings(html, tag)) push(heading);
  }
  for (const match of unescaped.matchAll(
    /"(?:title|desc|headline|linkName)"\s*:\s*"([^"\\]{8,180})"/g,
  )) {
    push(match[1] ?? null);
  }

  const ordered = ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  const strong = ordered.filter((item) => item.score >= 4);
  const chosen = strong.length >= 3 ? strong : ordered.filter((item) => item.score >= 2);
  return chosen.slice(0, 6).map((item) => item.text);
}

export function selectCompetitors(
  html: string,
  unescaped: string,
  pageUrl: string,
  brandName: string,
) {
  const found = new Map<string, DiscoveredCompetitor>();
  const add = (name: string | null, url: string | null) => {
    if (found.size >= 4) return;
    const cleaned = cleanCompetitorName(name, brandName);
    if (!cleaned) return;
    const key = cleaned.toLocaleLowerCase();
    const existing = found.get(key);
    if (existing) {
      if (!existing.url && url) existing.url = url;
      return;
    }
    found.set(key, { name: cleaned, url });
    if (found.size >= 4) return;
  };

  const cue =
    /\b(?:alternatives?\s+to|rivals?\s+(?:to|of)|competitors?\s+(?:include|like|such\s+as|:)|compared?\s+(?:to|with)|versus|\bvs\.?)\s+([A-Z][A-Za-z0-9&.'’-]{1,40}(?:\s+[A-Z][A-Za-z0-9&.'’-]{1,40}){0,2})/g;
  for (const match of unescaped.matchAll(cue)) add(match[1] ?? null, null);

  const instead =
    /\binstead\s+of\s+([A-Z][A-Za-z0-9&.'’-]{1,40}(?:\s+[A-Z][A-Za-z0-9&.'’-]{1,40}){0,2})/g;
  for (const match of unescaped.matchAll(instead)) add(match[1] ?? null, null);

  const pageHost = hostnameOf(pageUrl);
  for (const anchor of anchors(html, pageUrl)) {
    const blob = `${anchor.href} ${anchor.text}`;
    if (!/\balternatives?\b|\bcompare\b|\bcomparison\b|\bvs\b|\bversus\b|\bcompetitors?\b|\brivals?\b/i.test(blob)) {
      continue;
    }
    let url: URL;
    try {
      url = new URL(anchor.href, pageUrl);
    } catch {
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host || host === pageHost || host.endsWith(`.${pageHost}`)) {
      for (const match of `${anchor.text}`.matchAll(cue)) add(match[1] ?? null, null);
      continue;
    }
    const named = firstCueName(`${anchor.text} ${anchor.href}`, brandName);
    add(named ?? hostLabel(host), url.toString());
  }

  return [...found.values()].slice(0, 4);
}

function firstCueName(value: string, brandName: string) {
  const match = value.match(
    /\b(?:alternatives?\s+to|compared?\s+(?:to|with)|versus|\bvs\.?)\s+([A-Z][A-Za-z0-9&.'’-]{1,40})/,
  );
  return cleanCompetitorName(match?.[1] ?? null, brandName);
}

function cleanCompetitorName(value: string | null, brandName: string) {
  if (!value) return null;
  const name = value.replace(/\s+/g, " ").replace(/[.,;:]+$/g, "").trim();
  if (name.length < 2 || name.length > 40) return null;
  if (name.toLocaleLowerCase() === brandName.toLocaleLowerCase()) return null;
  const tokens = name.split(" ");
  if (tokens.every((token) => NAME_STOP.has(token.toLocaleLowerCase()))) return null;
  if (NAME_STOP.has(tokens[0]?.toLocaleLowerCase() ?? "")) return null;
  return name;
}

function promptScore(value: string) {
  const job =
    /switch|port-in|port in|\bbuy\b|\bplan\b|broadband|\bsim\b|\besim\b|discount|roaming|\bwifi\b|fibre|fiber|\bnumber\b|voucher|\bsave\b|homeowner|\b5g\b/i.test(
      value,
    );
  let score = 0;
  if (job) score += 4;
  if (value.includes("?") && job) score += 3;
  else if (value.includes("?")) score += 1;
  if (/\$\d|%\s*off|\bfree\b/i.test(value)) score += 3;
  if (value.length >= 28 && value.length <= 140) score += 2;
  if (value.length < 18 && !job) score -= 3;
  return score;
}

function isNav(value: string) {
  const key = value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  if (NAV.has(key)) return true;
  if (/cookie|copyright|terms of use|privacy|vulnerability|data protection|sign in|log in|chat with us|^(need help|how can we help)\b/i.test(key)) {
    return true;
  }
  return false;
}

function brandNameFrom(html: string, hostname: string) {
  const siteName = metaProperty(html, "og:site_name");
  if (siteName && siteName.length <= 40) return siteName;
  const title = textOf(firstTag(html, "title")) ?? "";
  const parts = title
    .split(/\s*(?:\||:|–|—)\s*|\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const named = parts.filter(
    (part) => part.length >= 2 && part.length <= 32 && !/\b(best|plans|home|mobile|broadband|official)\b/i.test(part),
  );
  if (named[0] && named[0].length <= 24) return named[0];
  if (named.length) return named[named.length - 1] ?? hostLabel(hostname);
  return hostLabel(hostname);
}

function headings(html: string, tag: string) {
  return [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map(
    (match) => match[1] ?? "",
  );
}

function anchors(html: string, pageUrl: string) {
  const tags = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
  return tags.flatMap((tag) => {
    const href = attr(tag, "href");
    if (!href || href.startsWith("#") || /^javascript:/i.test(href)) return [];
    const text = textOf(tag.replace(/^<a\b[^>]*>/i, "").replace(/<\/a>$/i, ""));
    try {
      return [{ href: new URL(href, pageUrl).toString(), text: text ?? "" }];
    } catch {
      return [];
    }
  });
}

function cleanLine(value: string | null) {
  const text = textOf(value);
  if (!text) return null;
  if (/[{}]|https?:\/\//i.test(text)) return null;
  if (text.length < 8 || text.length > 160) return null;
  return text;
}

function hostnameOf(pageUrl: string) {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function hostLabel(hostname: string) {
  const label = hostname.replace(/^www\./i, "").split(".")[0] ?? hostname;
  if (!label) return hostname;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function unescapeHtml(value: string) {
  return value
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&rsquo;|&#8217;|&rsquo;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function textOf(value: string | null) {
  if (!value) return null;
  const text = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function firstTag(html: string, tag: string) {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ?? null;
}

function metaContent(html: string, name: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const found = attr(tag, "name");
    if (found?.toLowerCase() !== name.toLowerCase()) continue;
    const content = attr(tag, "content");
    if (content) return content;
  }
  return null;
}

function metaProperty(html: string, property: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const found = attr(tag, "property");
    if (found?.toLowerCase() !== property.toLowerCase()) continue;
    const content = attr(tag, "content");
    if (content) return content;
  }
  return null;
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match?.[2]?.trim() || null;
}
