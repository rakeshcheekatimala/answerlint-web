"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ScoreGauge } from "@/components/ScoreGauge";
import type { UnlockedReportResponse } from "@/lib/reports/types";
import type {
  SiteOpsComparisonReport,
  SiteOpsReport,
} from "@/lib/siteops/types";
import { CodeCopyBlock } from "@/components/CodeCopyBlock";

type DownloadFormat = "json" | "html" | "csv";

const scoreTone: Record<string, string> = {
  excellent: "bg-emerald-100 text-emerald-800",
  good: "bg-green-100 text-green-800",
  "needs-improvement": "bg-amber-100 text-amber-800",
  poor: "bg-rose-100 text-rose-800",
};

export function UnlockedReportClient({
  reportId,
  claimToken,
}: {
  reportId: string;
  claimToken: string;
}) {
  const [data, setData] = useState<UnlockedReportResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!reportId) {
      setError("Missing report id.");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadReport() {
      setIsLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();
        if (claimToken) params.set("token", claimToken);
        const response = await fetch(
          `/api/reports/${reportId}${params.toString() ? `?${params}` : ""}`,
          { signal: controller.signal },
        );
        const payload = (await readJsonResponse(response)) as
          | UnlockedReportResponse
          | { error?: string };

        if (!response.ok || !("report" in payload)) {
          throw new Error(readApiError(payload, "Unable to load report."));
        }

        setData(payload);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load report.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadReport();

    return () => controller.abort();
  }, [claimToken, reportId]);

  if (isLoading) {
    return (
      <div className="rounded-[28px] border border-border bg-card p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
          Loading report
        </p>
        <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
          Opening your saved audit...
        </h1>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          We are verifying your session and loading the full report.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-700">
          Report locked
        </p>
        <h1 className="mt-4 font-display text-3xl font-semibold text-rose-950">
          We could not unlock this report.
        </h1>
        <p className="mt-3 text-sm leading-7 text-rose-800">
          {error || "Use the secure link from your email, or request a new report link."}
        </p>
        <Link
          href="/tools/geo-audit"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
        >
          Run a new audit
        </Link>
      </div>
    );
  }

  return <ReportContent data={data} />;
}

export function ReportContent({ data }: { data: UnlockedReportResponse }) {
  return (
    <div className="space-y-8">
      <ReportHeader data={data} />

      {data.kind === "single" ? (
        <SingleReportView
          report={data.report as SiteOpsReport}
          downloads={data.downloads}
        />
      ) : (
        <ComparisonReportView
          report={data.report as SiteOpsComparisonReport}
          downloads={data.downloads}
        />
      )}
    </div>
  );
}

function ReportHeader({ data }: { data: UnlockedReportResponse }) {
  return (
    <section className="rounded-[28px] border border-border bg-card p-6 shadow-soft sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
            Saved report
          </p>
          <h1 className="mt-4 break-words font-display text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
            {data.kind === "comparison"
              ? "Competitor visibility analysis"
              : "AI visibility audit"}
          </h1>
          <p className="mt-4 break-all text-sm leading-7 text-ink-muted">
            {data.targetUrl}
            {data.competitorUrl ? ` compared with ${data.competitorUrl}` : ""}
          </p>
        </div>
        <div className="rounded-[20px] border border-border bg-paper-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
            {data.email ? "Unlocked for" : "Report access"}
          </p>
          <p className="mt-2 break-all text-sm font-semibold text-ink">
            {data.email ?? "Ready to download"}
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            Created {new Date(data.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </section>
  );
}

function SingleReportView({
  report,
  downloads,
}: {
  report: SiteOpsReport;
  downloads: UnlockedReportResponse["downloads"];
}) {
  return (
    <>
      <ScoreBand scores={report.scores} />
      <DownloadPanel
        downloads={downloads}
        baseName="citeops-ai-visibility-report"
      />
      <AuditList
        title="Priority fixes"
        subtitle="Highest-impact recommendations from the saved SiteOps run."
        audits={report.audits.filter((audit) => audit.status !== "pass")}
      />
      <AuditList
        title="Passing signals"
        subtitle="Signals this page already sends clearly to answer engines."
        audits={report.audits.filter((audit) => audit.status === "pass")}
      />
    </>
  );
}

function ComparisonReportView({
  report,
  downloads,
}: {
  report: SiteOpsComparisonReport;
  downloads: UnlockedReportResponse["downloads"];
}) {
  const scoreItems = [
    { label: "Composite", value: report.comparison.scores.composite },
    { label: "AEO", value: report.comparison.scores.aeo },
    { label: "GEO", value: report.comparison.scores.geo },
  ];

  return (
    <>
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
          Verdict
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-ink">
          {report.comparison.leader.label}
        </h2>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          {report.comparison.leader.summary}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {scoreItems.map((item) => (
            <div
              key={item.label}
              className="rounded-[20px] border border-border bg-paper-muted p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-subtle">
                {item.label}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold text-ink">
                {item.value.target} vs {item.value.competitor}
              </p>
              <DeltaChip delta={item.value.delta} />
            </div>
          ))}
        </div>
      </section>
      <DownloadPanel
        downloads={downloads}
        baseName="citeops-competitor-analysis"
      />
      <InsightList title="Improve first" items={report.comparison.improve_first} />
      <InsightList
        title="Competitor edges"
        items={report.comparison.competitor_edges}
      />
      <AuditList
        title="Target priority fixes"
        subtitle="Target page findings that need attention."
        audits={report.target.audits.filter((audit) => audit.status !== "pass")}
      />
    </>
  );
}

function ScoreBand({ scores }: { scores: SiteOpsReport["scores"] }) {
  const items = [
    {
      label: "Composite readiness",
      value: scores.composite,
      helper: "Overall AI visibility risk",
    },
    {
      label: "AEO score",
      value: scores.aeo,
      helper: "Answer extraction clarity",
    },
    {
      label: "GEO score",
      value: scores.geo,
      helper: "Trust and citation depth",
    },
  ];

  return (
    <section className="rounded-[28px] border border-border bg-paper-muted p-6 shadow-soft">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-subtle">
            Score summary
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">
            Full audit score
          </h2>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold ${
            scoreTone[scores.band] || "bg-slate-100 text-slate-700"
          }`}
        >
          {scores.band.replace("-", " ")}
        </span>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <ScoreGauge
            key={item.label}
            label={item.label}
            value={item.value}
            helper={item.helper}
          />
        ))}
      </div>
    </section>
  );
}

function DownloadPanel({
  downloads,
  baseName,
}: {
  downloads: UnlockedReportResponse["downloads"];
  baseName: string;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-accent/30 bg-card shadow-soft">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="p-6 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            Export ready
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
            Take this report to your team
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted">
            Download the full audit with scores, priority fixes, evidence, and
            implementation notes. HTML is best for sharing, printing, or saving
            as PDF.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-paper-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink-subtle">
              Full findings
            </span>
            <span className="rounded-full bg-paper-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink-subtle">
              Evidence included
            </span>
            <span className="rounded-full bg-paper-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink-subtle">
              Developer handoff
            </span>
          </div>
        </div>
        <div className="border-t border-border bg-paper-muted p-5 lg:border-l lg:border-t-0">
          <button
            type="button"
            onClick={() => downloadReport(downloads.html, "html", baseName)}
            className="flex w-full items-center justify-between gap-4 rounded-[20px] bg-accent px-5 py-4 text-left text-accent-fg shadow-soft transition hover:bg-accent-hover"
          >
            <span>
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                Recommended
              </span>
              <span className="mt-1 block text-lg font-semibold">
                Download HTML report
              </span>
            </span>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-fg text-lg font-semibold text-accent">
              ↓
            </span>
          </button>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <DownloadButton
              label="JSON"
              helper="Raw data"
              onClick={() => downloadReport(downloads.json, "json", baseName)}
            />
            <DownloadButton
              label="CSV"
              helper="Spreadsheet"
              onClick={() => downloadReport(downloads.csv, "csv", baseName)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function AuditList({
  title,
  subtitle,
  audits,
}: {
  title: string;
  subtitle: string;
  audits: SiteOpsReport["audits"];
}) {
  if (audits.length === 0) return null;

  return (
    <section>
      <h2 className="font-display text-3xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
      <div className="mt-5 space-y-4">
        {audits.map((audit) => (
          <article key={audit.id} className="rounded-[24px] border border-border bg-card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="break-words font-display text-xl font-semibold text-ink sm:text-2xl">
                  {audit.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-ink-muted">
                  {audit.evidence}
                </p>
              </div>
              <span
                className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                  audit.status === "pass"
                    ? "bg-emerald-100 text-emerald-800"
                    : audit.status === "warn"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                }`}
              >
                {audit.status}
              </span>
            </div>
            {audit.recommendation ? (
              <div className="mt-4 rounded-[20px] bg-paper-muted p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                    {audit.recommendation.priority} priority
                  </span>
                  <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                    +{audit.recommendation.score_impact} impact
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink">
                  {audit.recommendation.instruction}
                </p>
                {audit.recommendation.code_snippet ? (
                  <CodeCopyBlock
                    code={audit.recommendation.code_snippet}
                    label="Fix snippet"
                    className="mt-4"
                    minHeightClassName="min-h-[6rem]"
                  />
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function InsightList({
  title,
  items,
}: {
  title: string;
  items: SiteOpsComparisonReport["comparison"]["improve_first"];
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="font-display text-3xl font-semibold text-ink">{title}</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <article key={`${title}-${item.id}`} className="rounded-[24px] border border-border bg-card p-5">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-paper-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                {item.priority} priority
              </span>
              <span className="rounded-full bg-paper-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                +{item.score_impact} impact
              </span>
            </div>
            <h3 className="mt-3 text-xl font-semibold text-ink">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-ink-muted">{item.reason}</p>
            <p className="mt-2 text-sm leading-7 text-ink">{item.action}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DeltaChip({ delta }: { delta: number }) {
  const tone =
    delta > 0
      ? "bg-emerald-100 text-emerald-800"
      : delta < 0
        ? "bg-rose-100 text-rose-800"
        : "bg-amber-100 text-amber-800";
  const label = delta > 0 ? `+${delta}` : String(delta);

  return (
    <span className={`mt-3 inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${tone}`}>
      {label}
    </span>
  );
}

function DownloadButton({
  label,
  helper,
  onClick,
}: {
  label: string;
  helper: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[16px] border border-border-strong bg-card px-4 py-3 text-left transition hover:border-accent hover:text-accent"
    >
      <span className="block text-sm font-semibold text-ink">{label}</span>
      <span className="mt-1 block text-xs text-ink-muted">{helper}</span>
    </button>
  );
}

function downloadReport(content: string, format: DownloadFormat, baseName: string) {
  const mimeType =
    format === "json"
      ? "application/json"
      : format === "html"
        ? "text/html"
        : "text/csv";
  const blob = new Blob([content], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `${baseName}.${format}`;
  link.click();
  URL.revokeObjectURL(blobUrl);
}

function readApiError(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(text || `Request failed with status ${response.status}.`);
  }
}
