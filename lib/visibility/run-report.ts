import { UnsafeUrlError, safeFetch } from "@/lib/net/url-guard";
import { readStoredCell, recallCell, rememberCell, writeStoredCell } from "@/lib/visibility/cell-store";
import { discoverFromHtml, type Discovery, type DiscoveredCompetitor } from "@/lib/visibility/discover";
import { askEngine, listEngines, type EngineAnswer, type EngineConfig } from "@/lib/visibility/engines";
import {
  buildLeadershipReport,
  cellCacheKey,
  type EngineCell,
  type EngineId,
  type LeadershipReport,
} from "@/lib/visibility/leadership";
import { probePage, type PageProbe } from "@/lib/visibility/site-audit";

export type AuditEvent =
  | { type: "status"; message: string }
  | { type: "discovery"; discovery: Discovery }
  | { type: "cell"; cell: EngineCell }
  | { type: "report"; report: LeadershipReport }
  | { type: "error"; message: string };

export type AuditInput = {
  phase: "discover" | "report";
  pageUrl: string;
  domain: string;
  brandName?: string;
  prompts?: string[];
  competitors?: DiscoveredCompetitor[];
  competitorNote?: string;
  cachedCells?: EngineCell[];
};

type Emit = (event: AuditEvent) => void;

export type AuditDeps = {
  fetchHtml?: (url: string) => Promise<string>;
  probe?: (target: { role: "brand" | "competitor"; name: string; url: string }) => Promise<PageProbe>;
  engines?: EngineConfig[];
  ask?: (input: {
    engine: EngineId;
    model: string;
    prompt: string;
    brandName: string;
    competitors: string[];
  }) => Promise<EngineAnswer>;
  loadCell?: (key: string) => Promise<EngineCell | null>;
  saveCell?: (cell: EngineCell) => Promise<void>;
  now?: () => string;
  deadlineMs?: number;
};

const PAGE_TIMEOUT_MS = 10_000;
const PAGE_MAX_BYTES = 4_000_000;

export async function runAudit(input: AuditInput, emit: Emit, deps: AuditDeps = {}) {
  if (input.phase === "discover") {
    await discoverPhase(input, emit, deps);
    return;
  }
  await reportPhase(input, emit, deps);
}

async function discoverPhase(input: AuditInput, emit: Emit, deps: AuditDeps) {
  emit({ type: "status", message: "Reading the site." });
  const html = await fetchHtml(input.pageUrl, deps);
  emit({ type: "status", message: "Choosing buyer questions." });
  const found = discoverFromHtml(html, input.pageUrl);
  const competitors = await competitorsFromLinkedPages(html, input.pageUrl, found.brandName, deps);
  const discovery: Discovery = {
    domain: input.domain,
    ...found,
    competitors: competitors.length ? competitors : found.competitors,
    competitorNote: (competitors.length ? competitors : found.competitors).length
      ? "These competitors were named on the public site."
      : "No competitor was found on the site.",
  };
  emit({
    type: "status",
    message: discovery.competitors.length
      ? `Found ${discovery.brandName}. ${discovery.prompts.length} buyer ${discovery.prompts.length === 1 ? "question" : "questions"}. ${discovery.competitors.length} ${discovery.competitors.length === 1 ? "competitor" : "competitors"} named on the site.`
      : `Found ${discovery.brandName}. ${discovery.prompts.length} buyer ${discovery.prompts.length === 1 ? "question" : "questions"}. No competitor was found on the site.`,
  });
  emit({ type: "discovery", discovery });
}

async function competitorsFromLinkedPages(
  html: string,
  pageUrl: string,
  brandName: string,
  deps: AuditDeps,
) {
  const home = discoverFromHtml(html, pageUrl);
  if (home.competitors.length) return home.competitors;
  const links = signalLinks(html, pageUrl).slice(0, 2);
  const merged = [...home.competitors];
  for (const link of links) {
    try {
      const linkedHtml = await fetchHtml(link, deps);
      for (const competitor of discoverFromHtml(linkedHtml, link).competitors) {
        if (merged.some((item) => item.name.toLocaleLowerCase() === competitor.name.toLocaleLowerCase())) continue;
        if (competitor.name.toLocaleLowerCase() === brandName.toLocaleLowerCase()) continue;
        merged.push(competitor);
      }
    } catch {
      // A comparison page that does not open is not a rival.
    }
  }
  return merged.slice(0, 4);
}

function signalLinks(html: string, pageUrl: string) {
  const pageHost = hostnameOf(pageUrl);
  const hrefs = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1] ?? "");
  const out: string[] = [];
  for (const href of hrefs) {
    if (!/\balternatives?\b|\bcompare\b|\bcomparison\b|\bvs\b|\bversus\b|\bcompetitors?\b|\brivals?\b/i.test(href)) {
      continue;
    }
    try {
      const url = new URL(href, pageUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      const host = url.hostname.replace(/^www\./i, "").toLowerCase();
      if (host !== pageHost && !host.endsWith(`.${pageHost}`)) continue;
      const value = url.toString();
      if (!out.includes(value)) out.push(value);
    } catch {
      // Skip links that are not URLs.
    }
  }
  return out;
}

async function reportPhase(input: AuditInput, emit: Emit, deps: AuditDeps) {
  const brandName = input.brandName?.trim() || input.domain;
  const prompts = (input.prompts ?? []).map((prompt) => prompt.trim()).filter(Boolean).slice(0, 6);
  const competitors = (input.competitors ?? []).slice(0, 4);
  const engines = deps.engines ?? listEngines();
  const started = Date.now();
  const deadlineMs = deps.deadlineMs ?? 45_000;
  emit({ type: "status", message: "Checking the public page." });

  const targets: Array<{ role: "brand" | "competitor"; name: string; url: string }> = [
    { role: "brand", name: brandName, url: input.pageUrl },
    ...competitors.flatMap((competitor) =>
      competitor.url ? [{ role: "competitor" as const, name: competitor.name, url: competitor.url }] : [],
    ),
  ];
  const pages = await Promise.all(targets.map((target) => (deps.probe ?? probePage)(target)));
  const cells: EngineCell[] = [];

  for (const engine of engines) {
    if (!engine.connected) {
      emit({ type: "status", message: "ChatGPT needs an API key." });
    }
  }

  const jobs = prompts.flatMap((prompt) => engines.map((engine) => ({ prompt, engine })));
  let cursor = 0;
  const workers = Array.from({ length: Math.min(3, Math.max(jobs.length, 1)) }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor];
      cursor += 1;
      if (!job) return;
      const cell = await resolveCell({
        domain: input.domain,
        prompt: job.prompt,
        engine: job.engine,
        brandName,
        competitors: competitors.map((competitor) => competitor.name),
        cachedCells: input.cachedCells ?? [],
        expired: Date.now() - started > deadlineMs,
        emit,
        deps,
      });
      cells.push(cell);
      emit({ type: "cell", cell });
    }
  });
  if (jobs.length) await Promise.all(workers);

  emit({ type: "status", message: "Writing the report." });
  const report = buildLeadershipReport({
    brandName,
    domain: input.domain,
    brandUrl: input.pageUrl,
    prompts,
    competitors,
    competitorNote:
      input.competitorNote ??
      (competitors.length
        ? "These competitors were named on the public site."
        : "No competitor was found on the site."),
    pages,
    cells,
    checkedAt: deps.now?.() ?? new Date().toISOString(),
  });
  emit({ type: "report", report });
}

async function resolveCell(input: {
  domain: string;
  prompt: string;
  engine: EngineConfig;
  brandName: string;
  competitors: string[];
  cachedCells: EngineCell[];
  expired: boolean;
  emit: Emit;
  deps: AuditDeps;
}): Promise<EngineCell> {
  const { engine } = input;
  if (!engine.connected) {
    return blankCell(input, "not_connected", null);
  }
  const key = cellCacheKey(input.domain, input.prompt, engine.id, engine.model);
  const cached =
    matchingCache(input.cachedCells, key, input.domain, input.prompt, engine) ??
    recallCell(key) ??
    (await (input.deps.loadCell ?? readStoredCell)(key));
  if (cached && cached.status === "saved" && cached.key === key) {
    const cell = { ...cached, fromCache: true };
    input.emit({
      type: "status",
      message: `Using the saved ${engine.label} result for “${shorten(input.prompt)}”.`,
    });
    return cell;
  }
  if (input.expired) {
    input.emit({
      type: "status",
      message: `Stopped before ${engine.label} so the report could finish.`,
    });
    return blankCell(input, "stopped", "Stopped so the report could finish.");
  }
  input.emit({
    type: "status",
    message: `Checking ${engine.label} for “${shorten(input.prompt)}”.`,
  });
  try {
    const answer = await (input.deps.ask ?? askEngine)({
      engine: engine.id,
      model: engine.model,
      prompt: input.prompt,
      brandName: input.brandName,
      competitors: input.competitors,
    });
    const cell: EngineCell = {
      key,
      domain: input.domain,
      prompt: input.prompt,
      engine: engine.id,
      model: engine.model,
      status: "saved",
      ranAt: input.deps.now?.() ?? new Date().toISOString(),
      brandMentioned: answer.brandMentioned,
      citedInstead: answer.citedInstead,
      citationUrls: answer.citationUrls,
      excerpt: answer.excerpt,
      fromCache: false,
      error: null,
    };
    rememberCell(cell);
    await Promise.race([
      (input.deps.saveCell ?? writeStoredCell)(cell),
      new Promise((resolve) => setTimeout(resolve, 1_500)),
    ]);
    return cell;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The answer could not be saved.";
    return blankCell(input, "error", message);
  }
}

function matchingCache(
  cells: EngineCell[],
  key: string,
  domain: string,
  prompt: string,
  engine: EngineConfig,
) {
  return (
    cells.find(
      (cell) =>
        cell.status === "saved" &&
        cell.key === key &&
        cell.domain === domain &&
        cell.prompt === prompt &&
        cell.engine === engine.id &&
        cell.model === engine.model,
    ) ?? null
  );
}

function blankCell(
  input: { domain: string; prompt: string; engine: EngineConfig },
  status: EngineCell["status"],
  error: string | null,
): EngineCell {
  return {
    key: cellCacheKey(input.domain, input.prompt, input.engine.id, input.engine.model),
    domain: input.domain,
    prompt: input.prompt,
    engine: input.engine.id,
    model: input.engine.model,
    status,
    ranAt: null,
    brandMentioned: null,
    citedInstead: [],
    citationUrls: [],
    excerpt: null,
    fromCache: false,
    error,
  };
}

async function fetchHtml(url: string, deps: AuditDeps) {
  if (deps.fetchHtml) return deps.fetchHtml(url);
  try {
    const response = await safeFetch(url, {
      timeoutMs: PAGE_TIMEOUT_MS,
      maxBytes: PAGE_MAX_BYTES,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "AnswerLintSiteAudit/1.0",
      },
    });
    if (!response.ok) throw new Error(`The site returned ${response.status}.`);
    const type = response.headers.get("content-type") ?? "";
    if (!/html|xml/i.test(type)) throw new Error("The URL opened, but it is not an HTML page.");
    return await response.text();
  } catch (error) {
    if (error instanceof UnsafeUrlError || error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("The site could not be reached.");
  }
}

function hostnameOf(pageUrl: string) {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function shorten(value: string) {
  return value.length > 80 ? `${value.slice(0, 79).trimEnd()}…` : value;
}
