import type { AuditFix, PageProbe, TechnicalRow } from "@/lib/visibility/site-audit";

export const ENGINE_IDS = ["chatgpt"] as const;

export type EngineId = (typeof ENGINE_IDS)[number];

export type EngineCellStatus = "saved" | "not_connected" | "error" | "stopped";

export type EngineCell = {
  key: string;
  domain: string;
  prompt: string;
  engine: EngineId;
  model: string;
  status: EngineCellStatus;
  ranAt: string | null;
  brandMentioned: boolean | null;
  citedInstead: string[];
  citationUrls: string[];
  excerpt: string | null;
  fromCache: boolean;
  error: string | null;
};

export type CitationColumn = {
  engine: EngineId;
  label: string;
  state: "not_connected" | "not_scored" | "no_citations" | "ready";
  savedAt: string | null;
};

export type LeadershipReport = {
  brandName: string;
  domain: string;
  brandUrl: string;
  headline: string;
  summary: string;
  checkedAt: string;
  competitorNote: string;
  columns: CitationColumn[];
  citationRows: Array<{
    name: string;
    role: "you" | "competitor";
    shares: Array<number | null>;
  }>;
  missingPrompts: Array<{ prompt: string; citedInstead: string[] }>;
  unscoredPrompts: string[];
  questionNote: string;
  pages: Array<PageProbe & { checks: TechnicalRow[] }>;
  fixes: AuditFix[];
  fixesNote: string;
  prompts: string[];
  cells: EngineCell[];
};

export type ReportEntity = {
  name: string;
  role: "you" | "competitor";
  hosts: string[];
};

const ENGINE_LABELS: Record<EngineId, string> = {
  chatgpt: "ChatGPT",
};

export function cellCacheKey(domain: string, prompt: string, engine: EngineId, model: string) {
  return [domain.trim().toLowerCase(), prompt.trim(), engine, model].join("\u001f");
}

export function buildLeadershipReport(input: {
  brandName: string;
  domain: string;
  brandUrl: string;
  prompts: string[];
  competitors: Array<{ name: string; url: string | null }>;
  competitorNote: string;
  pages: PageProbe[];
  cells: EngineCell[];
  checkedAt: string;
}): LeadershipReport {
  const entities: ReportEntity[] = [
    { name: input.brandName, role: "you", hosts: hostsFromDomain(input.domain) },
    ...input.competitors.map((competitor) => ({
      name: competitor.name,
      role: "competitor" as const,
      hosts: hostsFromUrl(competitor.url),
    })),
  ];
  const columns = ENGINE_IDS.map((engine) => columnFor(engine, input.cells));
  const citationRows = entities.map((entity) => ({
    name: entity.name,
    role: entity.role,
    shares: columns.map((column) => shareFor(column.engine, entity, entities, input.cells)),
  }));
  const missingPrompts = input.prompts.flatMap((prompt) => {
    const saved = input.cells.filter((cell) => cell.prompt === prompt && cell.status === "saved");
    if (!saved.length) return [];
    if (!saved.every((cell) => cell.brandMentioned === false)) return [];
    const citedInstead = unique(
      saved.flatMap((cell) => [...cell.citedInstead, ...namesFromUrls(cell.citationUrls, entities)]),
    );
    return [{ prompt, citedInstead }];
  });
  const unscoredPrompts = input.prompts.filter(
    (prompt) => !input.cells.some((cell) => cell.prompt === prompt && cell.status === "saved"),
  );
  const pages = input.pages.map((page) => ({ ...page, checks: technicalChecks(page) }));
  const fixes = fixesFor({
    brandName: input.brandName,
    domain: input.domain,
    missingPrompts,
    cells: input.cells,
    pages,
    entities,
  });
  const headline = headlineFor(input.brandName, input.competitors.length, missingPrompts, columns);
  const summary = summaryFor(input.competitorNote, columns, unscoredPrompts.length, missingPrompts.length);

  return {
    brandName: input.brandName,
    domain: input.domain,
    brandUrl: input.brandUrl,
    headline,
    summary,
    checkedAt: input.checkedAt,
    competitorNote: input.competitorNote,
    columns,
    citationRows,
    missingPrompts,
    unscoredPrompts,
    questionNote: questionNote(input.prompts.length, missingPrompts.length, unscoredPrompts.length),
    pages,
    fixes,
    fixesNote: fixesNote(fixes.length, missingPrompts.length, columns),
    prompts: input.prompts,
    cells: input.cells,
  };
}

export function technicalChecks(page: PageProbe): TechnicalRow[] {
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
        label: "Direct answer, canonical, structured data, citation readiness",
        status: "waiting",
        detail: "Checked only after the page opens as HTML.",
      },
    ];
  }

  return [
    row(`${page.role}-open`, "Page opens", true, `Opened ${page.url}.`),
    row(
      `${page.role}-heading`,
      "Heading",
      Boolean(page.heading),
      page.heading ?? "No h1 heading on the page.",
    ),
    row(
      `${page.role}-answer`,
      "Direct answer",
      page.hasDirectAnswer,
      page.hasDirectAnswer
        ? "A description or opening paragraph is on the page."
        : "No description or opening paragraph long enough to answer the page.",
    ),
    row(
      `${page.role}-canonical`,
      "Canonical",
      Boolean(page.canonical),
      page.canonical ?? "No canonical link.",
    ),
    row(
      `${page.role}-schema`,
      "Structured data",
      page.schemaTypes.length > 0,
      page.schemaTypes.length ? page.schemaTypes.join(", ") : "No structured data on the page.",
    ),
    row(
      `${page.role}-citation`,
      "Citation readiness",
      page.citationSignals.length > 0,
      page.citationSignals.length
        ? page.citationSignals.join(", ")
        : "No author, date, or article structured data.",
    ),
  ];
}

function columnFor(engine: EngineId, cells: EngineCell[]): CitationColumn {
  const own = cells.filter((cell) => cell.engine === engine);
  const saved = own.filter((cell) => cell.status === "saved");
  const savedAt = saved.map((cell) => cell.ranAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  if (!saved.length) {
    const state = own.some((cell) => cell.status === "not_connected") ? "not_connected" : "not_scored";
    return { engine, label: ENGINE_LABELS[engine], state, savedAt: null };
  }
  const hasEvidence = saved.some(
    (cell) => cell.brandMentioned || cell.citedInstead.length > 0 || cell.citationUrls.length > 0,
  );
  return {
    engine,
    label: ENGINE_LABELS[engine],
    state: hasEvidence ? "ready" : "no_citations",
    savedAt,
  };
}

function shareFor(
  engine: EngineId,
  entity: ReportEntity,
  entities: ReportEntity[],
  cells: EngineCell[],
) {
  const saved = cells.filter((cell) => cell.engine === engine && cell.status === "saved");
  if (!saved.length) return null;
  const counts = new Map(entities.map((item) => [item.name, 0]));
  let attributed = 0;
  for (const cell of saved) {
    const mentioned = cell.brandMentioned === true || cell.citedInstead.length > 0;
    if (!mentioned && cell.citationUrls.length === 0) continue;
    const hit = new Set<string>();
    for (const url of cell.citationUrls) {
      const host = hostOf(url);
      if (!host) continue;
      for (const candidate of entities) {
        if (candidate.hosts.some((item) => host === item || host.endsWith(`.${item}`))) {
          hit.add(candidate.name);
        }
      }
    }
    if (cell.brandMentioned && entities[0] && !hit.has(entities[0].name)) hit.add(entities[0].name);
    for (const name of cell.citedInstead) {
      if (entities.some((item) => item.name === name)) hit.add(name);
    }
    for (const name of hit) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
      attributed += 1;
    }
  }
  if (attributed === 0) return null;
  const percents = largestRemainder(
    entities.map((item) => ((counts.get(item.name) ?? 0) / attributed) * 100),
  );
  const index = entities.findIndex((item) => item.name === entity.name && item.role === entity.role);
  const count = counts.get(entity.name) ?? 0;
  if (count === 0 && entity.role === "competitor") return null;
  return percents[index] ?? 0;
}

function largestRemainder(values: number[]) {
  const floors = values.map((value) => Math.floor(value));
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = values
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const out = [...floors];
  for (const item of order) {
    if (left <= 0) break;
    out[item.index] = (out[item.index] ?? 0) + 1;
    left -= 1;
  }
  return out;
}

function fixesFor(input: {
  brandName: string;
  domain: string;
  missingPrompts: Array<{ prompt: string; citedInstead: string[] }>;
  cells: EngineCell[];
  pages: Array<PageProbe & { checks: TechnicalRow[] }>;
  entities: ReportEntity[];
}) {
  const drafts: Array<{ title: string; why: string }> = [];
  const cited = input.missingPrompts.filter((prompt) => prompt.citedInstead.length > 0);
  const quiet = input.missingPrompts.filter((prompt) => prompt.citedInstead.length === 0);
  for (const prompt of cited) {
    drafts.push({
      title: `Show up for “${shorten(prompt.prompt)}”`,
      why: `${prompt.citedInstead.join(", ")} was cited. ${input.brandName} was not.`,
    });
  }
  for (const prompt of quiet) {
    drafts.push({
      title: `Answer “${shorten(prompt.prompt)}”`,
      why: `${input.brandName} was absent in the saved answers, and no competitor was cited either.`,
    });
  }

  const gapPrompts = unique(
    input.cells
      .filter((cell) => cell.status === "saved" && cell.brandMentioned === true)
      .filter((cell) => {
        const saved = input.cells.filter((item) => item.prompt === cell.prompt && item.status === "saved");
        return !saved.some((item) => citesHost(item.citationUrls, input.domain));
      })
      .map((cell) => cell.prompt)
      .filter((prompt) => !input.missingPrompts.some((item) => item.prompt === prompt)),
  );
  for (const prompt of gapPrompts) {
    drafts.push({
      title: `Earn a citation for “${shorten(prompt)}”`,
      why: `${input.brandName} was named, but none of the saved citations point at ${input.domain}.`,
    });
  }

  const brand = input.pages.find((page) => page.role === "brand");
  if (brand && (!brand.opened || brand.error)) {
    drafts.push({
      title: "Make the brand page open",
      why: brand.error ?? "The brand page did not open, so the rest of the check did not run.",
    });
  } else if (brand) {
    if (!brand.heading) {
      drafts.push({
        title: "Add a heading",
        why: "The public page has no main heading.",
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
        why: "The page has no structured data, so it is harder to cite.",
      });
    }
    if (brand.citationSignals.length === 0) {
      drafts.push({
        title: "Add an author or a date",
        why: "The page does not show an author, a published date, or article structured data.",
      });
    }
  }

  return drafts.slice(0, 5).map((draft, index) => ({
    rank: index + 1,
    title: draft.title,
    why: draft.why,
  }));
}

function namesFromUrls(urls: string[], entities: ReportEntity[]) {
  const names: string[] = [];
  for (const url of urls) {
    const host = hostOf(url);
    if (!host) continue;
    for (const entity of entities) {
      if (entity.role !== "competitor") continue;
      if (entity.hosts.some((item) => host === item || host.endsWith(`.${item}`))) names.push(entity.name);
    }
  }
  return names;
}

function citesHost(urls: string[], domain: string) {
  const hosts = hostsFromDomain(domain);
  return urls.some((url) => {
    const host = hostOf(url);
    return Boolean(host && hosts.some((item) => host === item || host.endsWith(`.${item}`)));
  });
}

function headlineFor(
  brandName: string,
  competitorCount: number,
  missingPrompts: Array<{ citedInstead: string[] }>,
  columns: CitationColumn[],
) {
  const cited = missingPrompts.filter((prompt) => prompt.citedInstead.length > 0);
  if (cited.length) {
    return `${brandName} is absent on ${cited.length} buyer ${cited.length === 1 ? "question" : "questions"} where a competitor was cited.`;
  }
  const ready = columns.filter((column) => column.state === "ready");
  if (ready.length) {
    return `${brandName} has saved citation share on ${ready.map((column) => column.label).join(", ")}.`;
  }
  if (competitorCount === 0) {
    return `${brandName}: no competitor was found, and citation share is blank until an answer is saved.`;
  }
  return `${brandName}: citation share is blank until an answer is saved.`;
}

function summaryFor(
  competitorNote: string,
  columns: CitationColumn[],
  unscored: number,
  missing: number,
) {
  const chatgpt = columns.find((column) => column.engine === "chatgpt");
  if (!chatgpt || chatgpt.state === "not_connected") {
    return "ChatGPT needs an API key.";
  }
  const blank = columns.filter((column) => column.state !== "ready").map((column) => column.label);
  const blankNote = blank.length ? ` ${blank.join(", ")} ${blank.length === 1 ? "is" : "are"} blank.` : "";
  return `${competitorNote} ${missing} ${missing === 1 ? "question is" : "questions are"} missing. ${unscored} ${unscored === 1 ? "is" : "are"} not scored.${blankNote}`;
}

function questionNote(total: number, missing: number, unscored: number) {
  if (!total) return "The public page did not include a buyer question. Nothing is marked missing.";
  if (unscored === total) {
    return `${total} ${total === 1 ? "question comes" : "questions come"} from the site. ${unscored === 1 ? "It is" : "They are"} not scored, so none ${unscored === 1 ? "is" : "are"} marked missing.`;
  }
  return `${missing} missing. ${unscored} not scored. A question is missing only when saved answers leave the brand out.`;
}

function fixesNote(count: number, missing: number, columns: CitationColumn[]) {
  if (!count) return "No fix is supported by the saved answers or the page check.";
  const source = missing
    ? "Saved answers and the page check support these fixes."
    : columns.every((column) => column.state === "not_connected" || column.state === "not_scored")
      ? "These fixes come from the public page. No saved answer ranked a prompt."
      : "These fixes come from the saved answers and the page check.";
  return count < 5 ? `${count} of 5 fixes are supported. ${source}` : source;
}

function hostsFromDomain(domain: string) {
  const host = domain.replace(/^www\./i, "").toLowerCase();
  return host ? [host] : [];
}

function hostsFromUrl(url: string | null) {
  if (!url) return [];
  const host = hostOf(url);
  return host ? [host] : [];
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function row(id: string, label: string, ok: boolean, detail: string): TechnicalRow {
  return { id, label, status: ok ? "pass" : "needs_work", detail };
}

function unique(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function shorten(value: string) {
  return value.length > 90 ? `${value.slice(0, 89).trimEnd()}…` : value;
}
