"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import type { DiscoveredCompetitor, Discovery } from "@/lib/visibility/discover";
import type { EngineCell, EngineId, LeadershipReport } from "@/lib/visibility/leadership";

const inputClass =
  "mt-2 w-full rounded-xl border border-border bg-paper px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-ink focus:ring-4 focus:ring-ink/5";
const cardClass = "rounded-2xl border border-border bg-card shadow-soft";

const ENGINE_ORDER: EngineId[] = ["chatgpt"];
const STORAGE_KEY = "answerlint.visibility.cells.v1";
const MAX_QUESTIONS = 6;
const MAX_COMPETITORS = 4;

type CompetitorRow = DiscoveredCompetitor & { source: "site" | "added" };

type AuditEvent =
  | { type: "status"; message: string }
  | { type: "discovery"; discovery: Discovery }
  | { type: "cell"; cell: EngineCell }
  | { type: "report"; report: LeadershipReport }
  | { type: "error"; message: string };

const SECTIONS = [
  {
    index: "01",
    title: "Citation share",
    body: "Your brand and any competitor you include. Blank until a saved answer supports a share.",
  },
  {
    index: "02",
    title: "Prompts you are missing",
    body: "Buyer questions from the site. Not scored until an answer is saved.",
  },
  {
    index: "03",
    title: "Technical check",
    body: "Whether the public page opens, answers, and can be cited.",
  },
  {
    index: "04",
    title: "Prioritized fixes",
    body: "At most five, and only when the page or a saved answer supports them.",
  },
] as const;

export function SiteAuditClient() {
  const [domain, setDomain] = useState("");
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [brandName, setBrandName] = useState("");
  const [prompts, setPrompts] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([]);
  const [draftQuestion, setDraftQuestion] = useState("");
  const [extraName, setExtraName] = useState("");
  const [extraUrl, setExtraUrl] = useState("");
  const [report, setReport] = useState<LeadershipReport | null>(null);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"discover" | "report" | null>(null);

  useEffect(() => {
    if (!report) return;
    document.getElementById("visibility-report")?.scrollIntoView({ block: "start" });
  }, [report]);

  async function onRead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextDomain = String(new FormData(event.currentTarget).get("domain") ?? "").trim();
    setDomain(nextDomain);
    setError("");
    setReport(null);
    setDiscovery(null);
    setStep("Reading the site.");
    setPending("discover");
    try {
      await readStream(
        await fetch("/api/visibility/audit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ domain: nextDomain, phase: "discover" }),
        }),
        (auditEvent) => {
          if (auditEvent.type === "status") setStep(auditEvent.message);
          if (auditEvent.type === "error") setError(auditEvent.message);
          if (auditEvent.type === "discovery") {
            setDiscovery(auditEvent.discovery);
            setBrandName(auditEvent.discovery.brandName);
            setPrompts(auditEvent.discovery.prompts);
            setCompetitors(
              auditEvent.discovery.competitors.map((competitor) => ({ ...competitor, source: "site" })),
            );
            setExtraName("");
            setExtraUrl("");
          }
        },
      );
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "The site could not be read.");
    } finally {
      setPending(null);
    }
  }

  function addQuestion() {
    const next = uniqueQuestions([...prompts, draftQuestion]);
    if (next.length === prompts.length) return;
    setPrompts(next.slice(0, MAX_QUESTIONS));
    setDraftQuestion("");
  }

  async function onBuild() {
    if (!discovery) return;
    setError("");
    setReport(null);
    const pendingCompetitor = competitorFromDraft(extraName, extraUrl);
    const nextCompetitors = [
      ...competitors.filter((competitor) => competitor.name.trim()),
      ...(pendingCompetitor &&
      !competitors.some((competitor) => competitor.name.toLocaleLowerCase() === pendingCompetitor.name.toLocaleLowerCase())
        ? [{ ...pendingCompetitor, source: "added" as const }]
        : []),
    ].slice(0, MAX_COMPETITORS);
    const nextQuestions = uniqueQuestions([...prompts, draftQuestion]).slice(0, MAX_QUESTIONS);
    const note = competitorListNote(nextCompetitors);
    setPrompts(nextQuestions);
    setCompetitors(nextCompetitors);
    setDraftQuestion("");
    setExtraName("");
    setExtraUrl("");
    setStep(
      nextCompetitors.length
        ? `Using ${nextQuestions.length} buyer ${nextQuestions.length === 1 ? "question" : "questions"}. Competitors: ${nextCompetitors.map((item) => item.name).join(", ")}.`
        : `Using ${nextQuestions.length} buyer ${nextQuestions.length === 1 ? "question" : "questions"}. No competitor added.`,
    );
    setPending("report");
    try {
      await readStream(
        await fetch("/api/visibility/audit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            domain,
            phase: "report",
            brandName: brandName.trim(),
            prompts: nextQuestions,
            competitors: nextCompetitors.map(({ name, url }) => ({ name, url })),
            competitorNote: note,
            cachedCells: loadCachedCells(discovery.domain, nextQuestions),
          }),
        }),
        (auditEvent) => {
          if (auditEvent.type === "status") setStep(auditEvent.message);
          if (auditEvent.type === "error") setError(auditEvent.message);
          if (auditEvent.type === "cell") storeCells([auditEvent.cell]);
          if (auditEvent.type === "report") {
            storeCells(auditEvent.report.cells);
            setReport(auditEvent.report);
          }
        },
      );
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : "The report could not be built.");
    } finally {
      setPending(null);
    }
  }

  if (report) {
    return (
      <main id="main-content" className="safe-pad mx-auto max-w-content py-7 sm:px-6 lg:px-8 lg:py-8">
        <ReportView
          report={report}
          onEdit={() => {
            setReport(null);
            setStep("");
          }}
        />
      </main>
    );
  }

  return (
    <main id="main-content" className="safe-pad mx-auto max-w-content py-7 sm:px-6 lg:px-8 lg:py-10">
      <section className="overflow-hidden rounded-[1.5rem] border border-ink bg-ink px-5 py-8 text-paper shadow-[0_26px_70px_rgba(10,10,10,0.18)] sm:px-8 lg:px-10 lg:py-11">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-score-high">AI visibility report</p>
        <h1 className="mt-5 max-w-4xl font-display text-4xl font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl">
          Why answers cite your competitors.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
          Enter a domain. The page reads the public site, then you can add buyer questions and competitors
          before the report is built. Citation share stays blank until a saved answer supports it.
        </p>
      </section>

      <section className={`${cardClass} mt-6 overflow-hidden`}>
        <div className="border-b border-border px-5 py-5 sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">The page you get</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">One page. Four sections.</h2>
        </div>
        <ol className="grid lg:grid-cols-4">
          {SECTIONS.map((section) => (
            <li
              key={section.index}
              className="border-b border-border px-5 py-5 last:border-b-0 sm:px-6 lg:border-b-0 lg:border-r lg:last:border-r-0"
            >
              <p className="font-mono text-xs font-semibold text-ink-muted">{section.index}</p>
              <h3 className="mt-2 text-sm font-semibold text-ink">{section.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-muted">{section.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <form onSubmit={onRead} className={`${cardClass} mt-6 px-5 py-5 sm:px-8`}>
        <label className="block text-sm font-semibold text-ink" htmlFor="company-domain">
          Company domain
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="company-domain"
            name="domain"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="singtel.com"
            autoComplete="url"
            required
            className={`${inputClass} mt-0`}
          />
          <button
            type="submit"
            disabled={pending !== null}
            aria-busy={pending === "discover" ? true : undefined}
            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:bg-ink/90 disabled:opacity-70 ${
              pending === "discover" ? "cursor-wait" : "disabled:cursor-not-allowed"
            }`}
          >
            {pending === "discover" ? <WorkingDot className="h-2 w-2" /> : null}
            {pending === "discover" ? "Reading the site" : "Read the site"}
          </button>
        </div>
      </form>

      {!discovery && error ? <AuditError message={error} /> : null}
      {pending === "discover" && step ? <WorkStatus message={step} /> : null}

      {discovery ? (
        <section className={`${cardClass} mt-6 overflow-hidden`}>
          <div className="border-b border-border px-5 py-5 sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Found on the site</p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">{discovery.brandName}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{competitorListNote(competitors)}</p>
          </div>
          <div className="grid gap-6 px-5 py-5 sm:px-8 lg:grid-cols-2">
            <label className="block text-sm font-semibold text-ink" htmlFor="brand-name">
              Brand
              <input
                id="brand-name"
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                className={inputClass}
              />
            </label>
            <div>
              <p className="text-sm font-semibold text-ink">Competitors</p>
              <p className="mt-1 text-sm leading-6 text-ink-muted">Optional. Add a name and a site, or leave this blank.</p>
              {competitors.length ? (
                <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                  {competitors.map((competitor) => (
                    <li key={`${competitor.source}-${competitor.name}`} className="flex items-start justify-between gap-3 px-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{competitor.name}</p>
                        {competitor.url ? (
                          <p className="mt-1 break-words text-xs text-ink-muted">{competitor.url}</p>
                        ) : (
                          <p className="mt-1 text-xs text-ink-muted">No public page yet.</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                        onClick={() =>
                          setCompetitors((current) => current.filter((item) => item.name !== competitor.name))
                        }
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {competitors.length < MAX_COMPETITORS ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    aria-label="Competitor name"
                    value={extraName}
                    onChange={(event) => setExtraName(event.target.value)}
                    placeholder="Competitor name"
                    className={`${inputClass} mt-0`}
                  />
                  <input
                    aria-label="Competitor site"
                    value={extraUrl}
                    onChange={(event) => setExtraUrl(event.target.value)}
                    placeholder="competitor.com"
                    className={`${inputClass} mt-0`}
                  />
                  <button
                    type="button"
                    disabled={!extraName.trim()}
                    onClick={() => {
                      const next = competitorFromDraft(extraName, extraUrl);
                      if (!next) return;
                      setCompetitors((current) =>
                        current.some((item) => item.name.toLocaleLowerCase() === next.name.toLocaleLowerCase()) ||
                        current.length >= MAX_COMPETITORS
                          ? current
                          : [...current, { ...next, source: "added" }],
                      );
                      setExtraName("");
                      setExtraUrl("");
                    }}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl border border-border bg-paper px-4 py-3 text-sm font-semibold text-ink disabled:opacity-50"
                  >
                    Add competitor
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">Four competitors is the limit. Remove one to add another.</p>
              )}
            </div>
          </div>
          <div className="border-t border-border px-5 py-5 sm:px-8">
            <p className="text-sm font-semibold text-ink">Buyer questions</p>
            {prompts.length ? (
              <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                {prompts.map((prompt) => (
                  <li key={prompt} className="flex items-start justify-between gap-3 px-3 py-3">
                    <p className="min-w-0 text-sm leading-6 text-ink">{prompt}</p>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                      onClick={() => setPrompts((current) => current.filter((item) => item !== prompt))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                The public page did not include a buyer question. Add one, or build the report from the page check.
              </p>
            )}
            {prompts.length < MAX_QUESTIONS ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  aria-label="Buyer question"
                  value={draftQuestion}
                  onChange={(event) => setDraftQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    addQuestion();
                  }}
                  placeholder="Add a buyer question"
                  className={`${inputClass} mt-0`}
                />
                <button
                  type="button"
                  disabled={!draftQuestion.trim()}
                  onClick={addQuestion}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl border border-border bg-paper px-4 py-3 text-sm font-semibold text-ink disabled:opacity-50"
                >
                  Add question
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Six questions is the limit. Remove one to add another.</p>
            )}
            <button
              type="button"
              disabled={pending !== null || !brandName.trim()}
              aria-busy={pending === "report" ? true : undefined}
              onClick={() => void onBuild()}
              className={`mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:bg-ink/90 disabled:opacity-70 ${
                pending === "report" ? "cursor-wait" : "disabled:cursor-not-allowed"
              }`}
            >
              {pending === "report" ? <WorkingDot className="h-2 w-2" /> : null}
              {pending === "report" ? "Building the report" : "Build the report"}
            </button>
            {error ? <AuditError message={error} /> : null}
            {pending === "report" && step ? <WorkStatus message={step} /> : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function ReportView({ report, onEdit }: { report: LeadershipReport; onEdit: () => void }) {
  const brandPage = report.pages.find((page) => page.role === "brand");
  return (
    <article id="visibility-report" className="scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
          {report.brandName} · {report.domain}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="text-sm font-semibold text-ink underline-offset-2 hover:underline"
        >
          Edit setup
        </button>
      </div>
      <h1 className="mt-3 max-w-4xl text-balance font-display text-3xl font-semibold leading-[1.05] tracking-[-0.04em] text-ink sm:text-5xl">
        {report.headline}
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-ink-muted sm:text-base sm:leading-7">{report.summary}</p>
      <p className="mt-2 text-xs text-ink-muted">{checkedLabel(report.checkedAt)}</p>

      <Section index="01" title="Citation share vs competitors" note={report.competitorNote}>
        <div className="hidden sm:block">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Citation share on ChatGPT</caption>
            <thead>
              <tr className="border-b border-border text-ink-muted">
                <th className="px-5 py-3 font-medium sm:px-8">Brand</th>
                {report.columns.map((column) => (
                  <th key={column.engine} className="px-3 py-3 font-medium">
                    <span className="block text-ink">{column.label}</span>
                    <span className="mt-1 block text-xs font-normal">{columnState(column.state)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.citationRows.map((row) => (
                <tr key={`${row.role}-${row.name}`} className="border-b border-border last:border-b-0">
                  <th className="px-5 py-3 text-left font-semibold text-ink sm:px-8">
                    {row.name}
                    {row.role === "you" ? <span className="ml-2 font-normal text-ink-muted">You</span> : null}
                  </th>
                  {row.shares.map((share, index) => (
                    <td key={report.columns[index]?.engine ?? index} className="px-3 py-3 font-semibold text-ink">
                      {shareText(share)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="divide-y divide-border sm:hidden">
          {report.citationRows.map((row) => (
            <li key={`${row.role}-${row.name}`} className="px-5 py-4">
              <p className="text-sm font-semibold text-ink">
                {row.name}
                {row.role === "you" ? <span className="ml-2 font-normal text-ink-muted">You</span> : null}
              </p>
              <dl className="mt-3 grid grid-cols-1 gap-2">
                {report.columns.map((column, index) => (
                  <div key={column.engine} className="min-w-0">
                    <dt className="text-[11px] text-ink-muted">{column.label}</dt>
                    <dd className="text-sm font-semibold text-ink">{shareText(row.shares[index] ?? null)}</dd>
                    <dd className="text-[11px] text-ink-muted">{columnState(column.state)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </Section>

      <Section index="02" title="Prompts you are missing" note={report.questionNote}>
        {report.missingPrompts.length ? (
          <ul className="divide-y divide-border">
            {report.missingPrompts.map((prompt) => (
              <li key={prompt.prompt} className="px-5 py-3 sm:px-8">
                <p className="text-sm font-medium leading-6 text-ink">{prompt.prompt}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {prompt.citedInstead.length
                    ? `Cited instead: ${prompt.citedInstead.join(", ")}`
                    : "No competitor was cited."}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-ink sm:px-8">No saved answer left the brand out.</p>
        )}
        {report.unscoredPrompts.length ? (
          <div className="border-t border-border">
            <p className="px-5 pt-4 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted sm:px-8">
              Not scored
            </p>
            <ul className="divide-y divide-border">
              {report.unscoredPrompts.map((prompt) => (
                <li key={prompt} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-8">
                  <p className="min-w-0 text-sm leading-6 text-ink">{prompt}</p>
                  <span className="shrink-0 text-xs font-semibold text-ink-muted">Not scored</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section index="03" title="Technical check" note={brandPage?.url ?? report.brandUrl}>
        {(brandPage?.checks ?? []).map((check) => (
          <div key={check.id} className="grid gap-1 border-t border-border px-5 py-3 sm:grid-cols-[9rem_7rem_minmax(0,1fr)] sm:items-baseline sm:px-8">
            <p className="text-sm font-medium text-ink">{check.label}</p>
            <p className={`text-sm font-semibold ${check.status === "needs_work" ? "text-score-mid" : "text-ink"}`}>
              {checkStatus(check.status)}
            </p>
            <p className="min-w-0 break-words text-sm leading-6 text-ink-muted">{check.detail}</p>
          </div>
        ))}
        {report.pages
          .filter((page) => page.role === "competitor")
          .map((page) => (
            <div key={page.url} className="border-t border-border px-5 py-3 sm:px-8">
              <p className="text-sm font-medium text-ink">{page.name}</p>
              <p className="mt-1 break-words text-sm leading-6 text-ink-muted">
                {page.opened && !page.error ? `Opened ${page.url}.` : page.error ?? "The page did not open."}
              </p>
            </div>
          ))}
      </Section>

      <Section index="04" title="Five prioritized fixes" note={report.fixesNote}>
        {report.fixes.length ? (
          <ol className="divide-y divide-border">
            {report.fixes.map((fix) => (
              <li key={fix.rank} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 px-5 py-3 sm:px-8">
                <span className="font-mono text-sm font-semibold text-ink-muted">{fix.rank}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{fix.title}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">{fix.why}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-5 py-4 text-sm text-ink sm:px-8">No fix is supported yet.</p>
        )}
      </Section>

      <details className={`${cardClass} mt-6`}>
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-ink sm:px-8">
          Saved answers
          <span className="ml-2 font-normal text-ink-muted">
            {report.cells.filter((cell) => cell.status === "saved").length} saved
          </span>
        </summary>
        <div className="border-t border-border">
          {report.prompts.length ? (
            report.prompts.map((prompt) => (
              <div
                key={prompt}
                className="grid gap-3 border-b border-border px-5 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:px-8"
              >
                <p className="min-w-0 text-sm leading-6 text-ink">{prompt}</p>
                {ENGINE_ORDER.map((engine) => {
                  const cell = report.cells.find((item) => item.prompt === prompt && item.engine === engine);
                  return <AnswerCell key={engine} cell={cell} />;
                })}
              </div>
            ))
          ) : (
            <p className="px-5 py-4 text-sm text-ink-muted sm:px-8">No buyer questions were on the page.</p>
          )}
        </div>
      </details>
    </article>
  );
}

function Section({
  index,
  title,
  note,
  children,
}: {
  index: string;
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section className={`${cardClass} mt-4 overflow-hidden`}>
      <div className="flex items-baseline justify-between gap-4 px-5 py-4 sm:px-8">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
          <span className="mr-2 font-mono text-xs font-semibold text-ink-muted">{index}</span>
          {title}
        </h2>
      </div>
      <p className="break-words border-t border-border px-5 py-3 text-sm leading-6 text-ink-muted sm:px-8">{note}</p>
      {children}
    </section>
  );
}

function AnswerCell({ cell }: { cell: EngineCell | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">ChatGPT</p>
      <p className="text-sm font-semibold text-ink">{cellLabel(cell)}</p>
      {cell?.excerpt ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-muted">{cell.excerpt}</p> : null}
      {cell?.fromCache && cell.status === "saved" ? (
        <p className="mt-1 text-[11px] text-ink-muted">Saved earlier</p>
      ) : null}
    </div>
  );
}

function WorkStatus({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-paper px-4 py-3"
    >
      <span aria-hidden="true" className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink">
        <WorkingDot />
      </span>
      <p className="min-w-0 break-words text-sm font-medium leading-6 text-ink">{message}</p>
    </div>
  );
}

function WorkingDot({ className = "h-1.5 w-1.5" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 rounded-full bg-score-high motion-safe:animate-pulse ${className}`}
    />
  );
}

function AuditError({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-4 rounded-xl border border-border bg-paper px-4 py-3 text-sm text-ink">
      {message}
    </p>
  );
}

function columnState(state: LeadershipReport["columns"][number]["state"]) {
  if (state === "not_connected") return "Needs an API key";
  if (state === "no_citations") return "No citations";
  if (state === "ready") return "Saved";
  return "Not scored";
}

function shareText(share: number | null) {
  return share === null ? "Blank" : `${share}%`;
}

function checkStatus(status: "pass" | "needs_work" | "waiting") {
  if (status === "pass") return "Pass";
  if (status === "needs_work") return "Needs work";
  return "Waiting";
}

function cellLabel(cell: EngineCell | undefined) {
  if (!cell || cell.status === "not_connected") return "Needs an API key";
  if (cell.status === "error") return "Could not check";
  if (cell.status === "stopped") return "Stopped";
  if (cell.brandMentioned) return "Appeared";
  if (cell.brandMentioned === false) return "Absent";
  return "Saved";
}

function checkedLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Checked from the public page.";
  const formatted = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
  return `Checked ${formatted} UTC.`;
}

async function readStream(response: Response, onEvent: (event: AuditEvent) => void) {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("ndjson")) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "The report could not be built.");
  }
  if (!response.body) throw new Error("The report could not be built.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as AuditEvent);
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as AuditEvent);
}

function competitorFromDraft(name: string, url: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return { name: trimmed, url: url.trim() || null };
}

function competitorListNote(rows: Array<{ source?: "site" | "added" }>) {
  if (!rows.length) return "No competitor was found on the site. You can add one.";
  const added = rows.filter((row) => row.source === "added").length;
  const found = rows.length - added;
  if (added && found) return "Named on the site, plus competitors you added.";
  if (added) return "Competitors you added.";
  return "These competitors were named on the public site.";
}

function uniqueQuestions(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = value.trim();
    if (!text) continue;
    const key = text.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function loadCachedCells(domain: string, prompts: string[]) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as EngineCell[];
    return parsed.filter(
      (cell) => cell.status === "saved" && cell.domain === domain && prompts.includes(cell.prompt),
    );
  } catch {
    return [];
  }
}

function storeCells(cells: EngineCell[]) {
  try {
    const existing = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as EngineCell[];
    const byKey = new Map<string, EngineCell>();
    for (const cell of [...existing, ...cells]) {
      if (cell.status === "saved") byKey.set(cell.key, cell);
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...byKey.values()].slice(-200)));
  } catch {
    // A blocked browser still shows the report.
  }
}
