import type { ReactNode } from "react";

import type { LeadershipPage } from "@/lib/visibility/reporting";

const cardClass = "rounded-2xl border border-border bg-card shadow-soft";

const CONTRACT = [
  {
    index: "01",
    title: "Citation share vs competitors",
    body: "Of the pages the answers cite, how many are yours and how many belong to each competitor you name.",
  },
  {
    index: "02",
    title: "Prompts you are missing",
    body: "Buyer questions where you are absent on every repeat. One changing answer is not enough to call a prompt missing.",
  },
  {
    index: "03",
    title: "Technical check",
    body: "Whether the cited URLs open, whether any of them are yours, and whether the page text supports the claim.",
  },
  {
    index: "04",
    title: "Five prioritized fixes",
    body: "The changes repeated runs support, starting with prompts where a competitor is cited and you are not.",
  },
] as const;

export function ReportContract() {
  return (
    <section className={`${cardClass} mt-6 overflow-hidden`}>
      <div className="border-b border-border px-5 py-5 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
          The page you get
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
          One page for a leadership meeting.
        </h2>
      </div>
      <ol className="grid lg:grid-cols-4">
        {CONTRACT.map((section) => (
          <li
            key={section.index}
            className="border-b border-border px-5 py-5 last:border-b-0 sm:px-6 lg:border-b-0 lg:border-r lg:last:border-r-0"
          >
            <p className="font-mono text-xs font-semibold text-ink-muted">
              {section.index}
            </p>
            <h3 className="mt-2 text-sm font-semibold text-ink">{section.title}</h3>
            <p className="mt-2 text-xs leading-5 text-ink-muted">{section.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function LeadershipReport({ page }: { page: LeadershipPage }) {
  return (
    <article className="space-y-10">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
          One-page report
        </p>
        <h2 className="mt-2 max-w-3xl font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {page.headline}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted">{page.method}</p>
      </header>

      <ReportSection
        index="01"
        title="Citation share vs competitors"
        note={page.citationNote}
      >
        <ul className="space-y-4">
          {page.citationShare.map((row, index) => (
            <li
              key={`${row.role}-${row.name}-${index}`}
              className="grid items-center gap-3 sm:grid-cols-[minmax(0,11rem)_1fr_3.5rem]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{row.name}</p>
                <p className="text-[11px] text-ink-muted">
                  {row.share === null
                    ? "Not measured"
                    : `${row.citations} citation${row.citations === 1 ? "" : "s"}`}
                </p>
              </div>
              <div className="h-2 rounded-full bg-paper-muted" aria-hidden="true">
                <div
                  className={`h-2 rounded-full ${row.role === "you" ? "bg-ink" : "bg-ink/35"}`}
                  style={{ width: `${row.share ?? 0}%` }}
                />
              </div>
              <p className="font-mono text-sm font-semibold text-ink sm:text-right">
                {row.share === null ? "—" : `${row.share}%`}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-6 text-ink">{page.namedInPrompts}</p>
      </ReportSection>

      <ReportSection index="02" title="Prompts you are missing" note={page.missingNote}>
        {page.missingPrompts.length ? (
          <ul className="divide-y divide-border border-y border-border">
            {page.missingPrompts.map((prompt) => (
              <li key={prompt.promptId} className="py-4">
                <p className="text-sm font-semibold leading-6 text-ink">{prompt.prompt}</p>
                <p className="mt-1 text-xs leading-5 text-ink-muted">
                  Absent on {prompt.runs} repeat{prompt.runs === 1 ? "" : "s"}.
                  {prompt.citedInstead.length
                    ? ` Cited instead: ${prompt.citedInstead.join(", ")}.`
                    : " No competitor source was verified."}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </ReportSection>

      <ReportSection
        index="03"
        title="Technical check"
        note="These checks describe the citations. They are separate from citation share."
      >
        <ul className="divide-y divide-border border-y border-border">
          {page.technicalChecks.map((check) => (
            <li
              key={check.id}
              className="grid gap-1 py-3 sm:grid-cols-[8.5rem_1fr] sm:gap-6"
            >
              <p className={`text-xs font-bold uppercase tracking-wide ${statusClass(check.status)}`}>
                {statusLabel(check.status)}
              </p>
              <div>
                <p className="text-sm font-semibold text-ink">{check.label}</p>
                <p className="mt-1 text-xs leading-5 text-ink-muted">{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </ReportSection>

      <ReportSection index="04" title="Five prioritized fixes" note={page.fixesNote}>
        {page.fixes.length ? (
          <ol className="divide-y divide-border border-y border-border">
            {page.fixes.map((fix) => (
              <li key={fix.rank} className="grid grid-cols-[2rem_1fr] gap-3 py-4">
                <p className="font-mono text-sm font-semibold text-ink">{fix.rank}</p>
                <div>
                  <p className="text-sm font-semibold leading-6 text-ink">{fix.title}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-muted">{fix.why}</p>
                  <p className="mt-1 text-xs leading-5 text-ink-subtle">{fix.evidence}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </ReportSection>
    </article>
  );
}

function ReportSection({
  index,
  title,
  note,
  children,
}: {
  index: string;
  title: string;
  note: string;
  children?: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3">
        <p className="font-mono text-xs font-semibold text-ink-muted">{index}</p>
        <h3 className="font-display text-xl font-semibold tracking-tight text-ink">{title}</h3>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{note}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

function statusLabel(status: LeadershipPage["technicalChecks"][number]["status"]) {
  switch (status) {
    case "pass":
      return "Pass";
    case "needs_work":
      return "Needs work";
    case "partial":
      return "Partial";
    case "waiting":
      return "Waiting";
  }
}

function statusClass(status: LeadershipPage["technicalChecks"][number]["status"]) {
  switch (status) {
    case "pass":
      return "text-emerald-700";
    case "needs_work":
      return "text-ink";
    case "partial":
      return "text-amber-800";
    case "waiting":
      return "text-ink-muted";
  }
}
