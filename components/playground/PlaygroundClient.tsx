"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import type {
  ComparisonReportPreview,
  GatedReportResponse,
  SingleReportPreview,
  UnlockedReportResponse,
} from "@/lib/reports/types";
import { ReportContent } from "@/components/reports/UnlockedReportClient";
import { ScoreGauge } from "@/components/ScoreGauge";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const scoreTone: Record<string, string> = {
  excellent: "bg-emerald-100 text-emerald-800",
  good: "bg-green-100 text-green-800",
  "needs-improvement": "bg-amber-100 text-amber-800",
  poor: "bg-rose-100 text-rose-800",
};

export function PlaygroundClient({ initialUrl = "" }: { initialUrl?: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [auditData, setAuditData] = useState<GatedReportResponse | null>(null);
  const [comparisonData, setComparisonData] = useState<GatedReportResponse | null>(
    null,
  );
  const [auditError, setAuditError] = useState("");
  const [comparisonError, setComparisonError] = useState("");
  const [isAuditing, startAudit] = useTransition();
  const [isComparing, startComparison] = useTransition();

  const report =
    auditData?.preview.kind === "single" ? auditData.preview : null;

  function handleAuditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuditError("");
    setComparisonError("");
    setComparisonData(null);

    startAudit(async () => {
      try {
        const response = await fetch("/api/playground/audit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const payload = (await readJsonResponse(response)) as
          | GatedReportResponse
          | { error?: string };

        if (!response.ok || !("preview" in payload)) {
          throw new Error(readApiError(payload, "Audit failed."));
        }

        setAuditData(payload);
      } catch (error) {
        setAuditData(null);
        setAuditError(
          error instanceof Error ? error.message : "Unable to audit this URL.",
        );
      }
    });
  }

  function handleCompetitorAnalysis() {
    if (!url.trim() || !competitorUrl.trim()) return;

    setComparisonError("");
    startComparison(async () => {
      try {
        const response = await fetch("/api/playground/competitors", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, competitorUrl }),
        });
        const payload = (await readJsonResponse(response)) as
          | GatedReportResponse
          | { error?: string };

        if (!response.ok || !("preview" in payload)) {
          throw new Error(
            readApiError(payload, "Competitor comparison could not be completed."),
          );
        }

        setComparisonData(payload);
      } catch (error) {
        setComparisonError(
          error instanceof Error
            ? error.message
            : "Competitor comparison could not be completed.",
        );
      }
    });
  }

  return (
    <div className="safe-pad mx-auto max-w-content py-12 sm:px-6 lg:px-8 lg:py-20">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-10">
        <section
          aria-labelledby="playground-title"
          className="min-w-0 rounded-[28px] border border-border bg-card p-5 shadow-soft sm:p-8"
        >
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
              Playground
            </p>
            <h1
              id="playground-title"
              className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-5xl"
            >
              Run a zero-token AnswerLint audit, then compare it with a competitor.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-muted sm:text-lg">
              Enter a URL to generate AEO and GEO scores with AnswerLint
              heuristics. The standard scan is deterministic, so you see a
              focused preview first without sending page content to a third-party
              LLM.
            </p>
          </div>

          <form
            className="mt-8 space-y-4"
            onSubmit={handleAuditSubmit}
            aria-describedby="playground-help"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">
                URL to audit
              </span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/blog/aeo-guide"
                inputMode="url"
                autoComplete="url"
                aria-describedby="playground-help"
                className="w-full rounded-2xl border border-border-strong bg-wash px-4 py-3 text-base text-ink outline-none transition focus:border-accent"
              />
            </label>
            <AuditTrustBadges />
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">
                Competitor URL
              </span>
              <input
                value={competitorUrl}
                onChange={(event) => {
                  setCompetitorUrl(event.target.value);
                  setComparisonData(null);
                }}
                placeholder="https://competitor.example.com/docs/article"
                inputMode="url"
                autoComplete="url"
                className="w-full rounded-2xl border border-border-strong bg-wash px-4 py-3 text-base text-ink outline-none transition focus:border-accent"
              />
            </label>
            <p id="playground-help" className="text-sm text-ink-muted">
              Full reports are saved to your account so you can revisit the
              recommendations, exports, and competitor gaps later.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="submit"
                disabled={isAuditing}
                className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAuditing ? "Calculating score..." : "Get AI visibility score"}
              </button>
              <button
                type="button"
                disabled={!url.trim() || !competitorUrl.trim() || isComparing}
                onClick={handleCompetitorAnalysis}
                className="inline-flex w-full items-center justify-center rounded-full border border-border-strong bg-paper px-6 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {isComparing ? "Comparing pages..." : "Competitor analysis"}
              </button>
            </div>
          </form>

          {isAuditing || isComparing ? (
            <AuditSkeleton
              title={isComparing ? "Comparing pages" : "Running AnswerLint audit"}
            />
          ) : null}

          {auditError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {auditError}
            </p>
          ) : null}

          {comparisonError ? (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {comparisonError}
            </p>
          ) : null}

          {report ? (
            <div className="mt-8 space-y-8">
              <ScoreSummary report={report} />
              <BusinessScanNextStep report={report} />

              {auditData ? (
                <UnlockReportPanel data={auditData} />
              ) : null}

              <PreviewIssueList
                title="Preview blockers"
                subtitle="The full report includes every finding, implementation note, and export."
                issues={report.topIssues}
              />

              <LockedValuePanel />
            </div>
          ) : null}
        </section>

        <aside className="min-w-0 space-y-6">
          <div className="min-w-0 rounded-[28px] border border-border bg-paper-muted p-6 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
              Two modes
            </p>
            <div className="mt-4 space-y-5">
              <div>
                <h2 className="font-display text-2xl font-semibold text-ink">
                  AnswerLint only
                </h2>
                <p className="mt-2 text-sm leading-7 text-ink-muted">
                  Non-AI analysis computes AEO, GEO, composite scoring, and
                  recommendation snippets directly in the app.
                </p>
              </div>
              <div>
                <h2 className="font-display text-2xl font-semibold text-ink">
                  Competitor compare
                </h2>
                <p className="mt-2 text-sm leading-7 text-ink-muted">
                  Add a second URL and the app audits target and competitor with
                  the same AnswerLint pass, then reports deltas, edges, and first
                  fixes.
                </p>
              </div>
            </div>
          </div>

          {comparisonData ? (
            <CompetitorResults data={comparisonData} />
          ) : (
            <div className="min-w-0 rounded-[28px] border border-dashed border-border-strong bg-card p-6">
              <h2 className="font-display text-2xl font-semibold text-ink">
                Competitor analysis output
              </h2>
              <p className="mt-3 text-sm leading-7 text-ink-muted">
                Enter a competitor URL and run analysis to see target versus
                competitor scores, check-level deltas, and the actions that can
                close the gap.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function AuditTrustBadges() {
  const badges = [
    {
      label: "Zero-token AnswerLint scan",
      body: "The standard audit uses deterministic checks, not an LLM prompt.",
    },
    {
      label: "Privacy-first by default",
      body: "Page content is not sent to third-party LLMs for the standard scan.",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {badges.map((badge) => (
        <div
          key={badge.label}
          className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3"
        >
          <p className="text-sm font-semibold text-emerald-950">{badge.label}</p>
          <p className="mt-1 text-xs leading-5 text-emerald-800">
            {badge.body}
          </p>
        </div>
      ))}
    </div>
  );
}

function AuditSkeleton({ title }: { title: string }) {
  return (
    <section
      aria-live="polite"
      aria-busy="true"
      className="mt-5 min-h-[24rem] rounded-[24px] border border-border bg-paper-muted p-5"
    >
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">
            {title}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Building the same evidence trail the report will use.
          </p>
        </div>
        <span className="h-9 w-24 animate-pulse rounded-full bg-border" />
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {["Composite", "AEO", "GEO"].map((label) => (
          <div
            key={label}
            className="min-h-[10.5rem] rounded-[20px] border border-border bg-card p-4"
          >
            <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-border" />
            <div className="mx-auto mt-4 h-3 w-24 animate-pulse rounded-full bg-border" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="min-h-14 rounded-[16px] border border-border bg-card px-4 py-3"
          >
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-border" />
            <div className="mt-3 h-2 w-11/12 animate-pulse rounded-full bg-border" />
          </div>
        ))}
      </div>
    </section>
  );
}

function ScoreSummary({ report }: { report: SingleReportPreview }) {
  const scores = [
    {
      label: "Composite readiness",
      value: report.scores.composite,
      helper: "Overall AI visibility risk",
    },
    {
      label: "AEO score",
      value: report.scores.aeo,
      helper: "Answer extraction clarity",
    },
    {
      label: "GEO score",
      value: report.scores.geo,
      helper: "Trust and citation depth",
    },
  ];

  return (
    <section className="min-w-0 rounded-[24px] border border-border bg-paper-muted p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-subtle">
            Audit result
          </p>
          <h2 className="mt-2 break-words font-display text-2xl font-semibold text-ink sm:text-3xl">
            {report.targetUrl}
          </h2>
          <p className="mt-2 break-all text-sm text-ink-muted">
            Generated {new Date(report.createdAt).toLocaleString()}
          </p>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold ${
            scoreTone[report.scores.band] || "bg-slate-100 text-slate-700"
          }`}
        >
          {report.scores.band.replace("-", " ")}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {scores.map((score) => (
          <ScoreGauge
            key={score.label}
            label={score.label}
            value={score.value}
            helper={score.helper}
          />
        ))}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-border bg-card px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            Preview blockers
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink">{report.issueCount}</p>
        </div>
        <div className="rounded-[18px] border border-border bg-card px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            Passing signals
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink">{report.passCount}</p>
        </div>
      </div>
    </section>
  );
}

function BusinessScanNextStep({ report }: { report: SingleReportPreview }) {
  const businessScanHref = `/tools/business-aware-scan?siteUrl=${encodeURIComponent(
    getSiteOrigin(report.targetUrl),
  )}`;

  return (
    <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 shadow-[0_18px_45px_rgb(146_64_14_/_0.08)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-800">
            One page is only the start
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">
            Want to know which pages matter first?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-amber-950/80">
            Business-Aware Scan maps the site into revenue, trust, developer,
            support, and content pages, then shows the fastest visibility gains.
          </p>
        </div>
        <Link
          href={businessScanHref}
          className="inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
        >
          Map My AI Visibility
        </Link>
      </div>
    </section>
  );
}

function getSiteOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function PreviewIssueList({
  title,
  subtitle,
  issues,
}: {
  title: string;
  subtitle: string;
  issues: SingleReportPreview["topIssues"];
}) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="font-display text-3xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
      <div className="mt-5 space-y-4">
        {issues.map((issue) => (
          <article
            key={issue.id}
            className="min-w-0 rounded-[24px] border border-border bg-card p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="break-words font-display text-xl font-semibold text-ink sm:text-2xl">
                  {issue.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-ink-muted">
                  {issue.evidence}
                </p>
              </div>
              <span
                className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                  issue.status === "pass"
                    ? "bg-emerald-100 text-emerald-800"
                    : issue.status === "warn"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                }`}
              >
                {issue.status}
              </span>
            </div>

            {issue.priority ? (
              <div className="mt-4 rounded-[20px] bg-paper-muted p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                    {issue.priority} priority
                  </span>
                  <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                    +{issue.scoreImpact ?? 0} impact
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink-muted">
                  Full implementation details unlock in the saved report.
                </p>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function CompetitorResults({
  data,
}: {
  data: GatedReportResponse;
}) {
  if (data.preview.kind !== "comparison") {
    return null;
  }

  const preview = data.preview;
  const scoreItems = [
    {
      label: "Composite",
      target: preview.targetScores.composite,
      competitor: preview.competitorScores.composite,
      delta: preview.targetScores.composite - preview.competitorScores.composite,
    },
    {
      label: "AEO",
      target: preview.targetScores.aeo,
      competitor: preview.competitorScores.aeo,
      delta: preview.targetScores.aeo - preview.competitorScores.aeo,
    },
    {
      label: "GEO",
      target: preview.targetScores.geo,
      competitor: preview.competitorScores.geo,
      delta: preview.targetScores.geo - preview.competitorScores.geo,
    },
  ];

  return (
    <div className="min-w-0 space-y-6 rounded-[28px] border border-border bg-card p-6 shadow-soft">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
          Competitor verdict
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-ink">
          {preview.leader.label}
        </h2>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          {preview.leader.summary}
        </p>
      </div>

      <div className="grid gap-3">
        <UrlCard label="Target" url={preview.targetUrl} />
        <UrlCard label="Competitor" url={preview.competitorUrl} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {scoreItems.map((item) => (
          <div
            key={item.label}
            className="min-w-0 rounded-[20px] border border-border bg-paper-muted p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
              {item.label}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-ink">
              {item.target} vs {item.competitor}
            </p>
            <DeltaChip delta={item.delta} />
          </div>
        ))}
      </div>

      <UnlockReportPanel
        data={data}
        compact
      />

      <InsightList title="Improve first" items={preview.improveFirst} />
      <InsightList title="Competitor edge" items={preview.competitorEdges} />
    </div>
  );
}

function UrlCard({ label, url }: { label: string; url: string }) {
  return (
    <div className="min-w-0 rounded-[20px] border border-border bg-paper-muted p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
        {label}
      </p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block break-all text-sm font-semibold text-accent underline-offset-4 hover:underline"
      >
        {url}
      </a>
    </div>
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
    <span
      className={`mt-3 inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${tone}`}
    >
      {label}
    </span>
  );
}

function InsightList({
  title,
  items,
}: {
  title: string;
  items: ComparisonReportPreview["improveFirst"];
}) {
  return (
    <div>
      <h3 className="font-display text-2xl font-semibold text-ink">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <article
              key={`${title}-${item.id}`}
              className="rounded-[20px] border border-border bg-paper-muted p-4"
            >
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                  {item.priority} priority
                </span>
                <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                  +{item.score_impact} impact
                </span>
              </div>
              <h4 className="mt-3 text-lg font-semibold text-ink">
                {item.title}
              </h4>
              <p className="mt-2 text-sm leading-7 text-ink-muted">
                {item.reason}
              </p>
              <p className="mt-2 text-sm leading-7 text-ink">{item.action}</p>
            </article>
          ))
        ) : (
          <p className="rounded-[20px] border border-border bg-paper-muted p-4 text-sm leading-7 text-ink-muted">
            No priority gaps found for this section.
          </p>
        )}
      </div>
    </div>
  );
}

function LockedValuePanel() {
  const items = [
    "All priority fixes with implementation guidance",
    "Downloadable JSON, HTML, and CSV exports",
    "Optional account path for saved reports later",
  ];

  return (
    <section className="rounded-[24px] border border-border bg-paper-muted p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-subtle">
        Unlocks in full report
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item} className="rounded-[18px] border border-border bg-card p-4">
            <p className="text-sm leading-6 text-ink">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function UnlockReportPanel({
  data,
  compact = false,
}: {
  data: GatedReportResponse;
  compact?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [unlockedEmail, setUnlockedEmail] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();
  const [isGoogleLoading, startGoogle] = useTransition();
  const isMagicLinkMode = data.access.accessMode === "magic_link";
  const isGoogleMode = data.access.accessMode === "google_login";
  const isOpenMode = data.access.accessMode === "open";
  const googleAuthEnabled = data.access.googleAuthEnabled;
  const isUnlocked = isOpenMode || unlockedEmail !== null;
  const isEmailSubmitDisabled = isSending || (isMagicLinkMode && resendCooldown > 0);

  const reportPath = `/tools/geo-audit/report?id=${encodeURIComponent(
    data.reportId,
  )}&token=${encodeURIComponent(data.claimToken)}`;

  const unlockedReport = createUnlockedReportResponse(data, unlockedEmail);

  useEffect(() => {
    if (!isMagicLinkMode || resendCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isMagicLinkMode, resendCooldown]);

  function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isEmailSubmitDisabled) return;
    setMessage("");
    setError("");

    startSending(async () => {
      const endpoint = `/api/reports/${data.reportId}/unlock`;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, claimToken: data.claimToken }),
        });
        const payload = (await readJsonResponse(response)) as
          | { ok: boolean; captured?: boolean; message: string }
          | { error?: string };

        if (!response.ok || !("ok" in payload)) {
          const apiError = new Error(
            readApiError(
              payload,
              isMagicLinkMode
                ? "Unable to send report link."
                : "Unable to unlock report.",
            ),
          );

          if (response.status === 429) {
            setResendCooldown(60);
          }

          throw apiError;
        }

        if (isMagicLinkMode) {
          setResendCooldown(60);
        } else {
          setUnlockedEmail(email.trim().toLowerCase());
        }

        setMessage(payload.message);
      } catch (sendError) {
        setError(
          sendError instanceof Error
            ? formatRequestError(sendError, endpoint)
            : "Unable to unlock report.",
        );
      }
    });
  }

  if (isUnlocked) {
    return (
      <div className={compact ? "space-y-5" : "space-y-8"}>
        <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
            Report ready
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold">
            Your full report is unlocked.
          </h2>
          <p className="mt-2 text-sm leading-7 text-emerald-900">
            {unlockedEmail
              ? "Download the report below. We will use the email only to understand who found the audit useful and follow up about the product."
              : "Download the report below. Email capture is currently disabled for this flow."}
          </p>
        </section>
        <ReportContent data={unlockedReport} />
      </div>
    );
  }

  function handleGoogleUnlock() {
    setMessage("");
    setError("");

    startGoogle(async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const redirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(
          reportPath,
        )}`;
        const { data, error: authError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            queryParams: { prompt: "select_account" },
          },
        });

        if (authError) {
          throw authError;
        }

        if (data.url) {
          window.location.href = data.url;
        }
      } catch (googleError) {
        setError(
          googleError instanceof Error
            ? googleError.message
            : "Unable to start Google sign-in.",
        );
      }
    });
  }

  return (
    <section
      className={`rounded-[24px] border border-border-strong bg-ink p-5 text-paper shadow-soft ${
        compact ? "" : "sm:p-6"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-paper-muted">
            {isMagicLinkMode
              ? "Secure unlock"
              : isGoogleMode
                ? "Account unlock"
                : "Unlock report"}
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold">
            {isMagicLinkMode
              ? "Send the full report to your inbox"
              : isGoogleMode
                ? "Continue with Google to save this report"
                : "Enter email to download the full report"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-paper-muted">
            The saved report includes all recommendations, evidence, and exports
            for{" "}
            {data.preview.kind === "comparison"
              ? "this comparison"
              : data.preview.targetUrl}
            .
          </p>
        </div>
        {isMagicLinkMode ? (
          <Link
            href={reportPath}
            className="inline-flex w-fit items-center justify-center rounded-full border border-paper/25 px-4 py-2 text-sm font-semibold text-paper transition hover:bg-paper hover:text-ink"
          >
            Already unlocked?
          </Link>
        ) : null}
      </div>

      {!isGoogleMode ? (
        <form
          className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={handleEmailSubmit}
          noValidate
        >
          <label className="block">
            <span className="sr-only">Work email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
              className="w-full rounded-2xl border border-paper/20 bg-paper px-4 py-3 text-base text-ink outline-none transition placeholder:text-ink-subtle focus:border-accent"
            />
          </label>
          <button
            type="submit"
            disabled={isEmailSubmitDisabled}
            className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending
              ? isMagicLinkMode
                ? "Sending..."
                : "Unlocking..."
              : isMagicLinkMode && resendCooldown > 0
                ? `Retry in ${resendCooldown}s`
                : isMagicLinkMode
                  ? "Send secure report link"
                  : "Unlock full report"}
          </button>
        </form>
      ) : null}

      {isGoogleMode && !googleAuthEnabled ? (
        <p className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Google sign-in is not configured for this environment.
        </p>
      ) : googleAuthEnabled || isGoogleMode ? (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleGoogleUnlock}
            disabled={isGoogleLoading}
            className="inline-flex items-center justify-center rounded-full border border-paper/25 px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGoogleLoading ? "Opening Google..." : "Continue with Google"}
          </button>
          <p className="text-xs leading-6 text-paper-muted">
            Google sign-in is for the future saved-reports experience. Email
            capture remains the lighter MVP path.
          </p>
        </div>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-2xl border border-emerald-300/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-300/40 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
    </section>
  );
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

function formatRequestError(error: Error, endpoint: string) {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return `Unable to reach the report unlock endpoint at ${endpoint}. Refresh the page and try again.`;
  }

  return error.message;
}

function createUnlockedReportResponse(
  data: GatedReportResponse,
  email: string | null,
): UnlockedReportResponse {
  return {
    id: data.reportId,
    kind: data.preview.kind,
    email,
    targetUrl: data.preview.targetUrl,
    competitorUrl:
      data.preview.kind === "comparison" ? data.preview.competitorUrl : null,
    createdAt: data.preview.createdAt,
    unlockedAt: new Date().toISOString(),
    report: data.report,
    downloads: data.downloads,
  };
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(text || `Request failed with status ${response.status}.`);
  }
}
