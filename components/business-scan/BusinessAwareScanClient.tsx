"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  BUSINESS_CATEGORIES,
  IMPACT_TIERS,
  type BusinessCategory,
  type BusinessImpactTier,
  type BusinessScanDashboard,
  type BusinessScanPage,
  type BusinessScanProject,
  type DiscoveryProgressEvent,
} from "@/lib/business-scan/types";
import {
  computeBusinessVisibilityScore,
  formatScoringMix,
  summarizeReviewState,
} from "@/lib/business-scan/scoring";

type Props = {
  initialBaseUrl?: string;
  initialProjectId?: string;
};

type ProgressItem = {
  message: string;
  pageCount: number;
  groups: Array<{ category: BusinessCategory; count: number }>;
};

const categoryTone: Record<BusinessCategory, string> = {
  "Revenue Pages": "border-emerald-200 bg-emerald-50 text-emerald-950",
  "Trust Pages": "border-sky-200 bg-sky-50 text-sky-950",
  "Developer Pages": "border-indigo-200 bg-indigo-50 text-indigo-950",
  "Support Pages": "border-amber-200 bg-amber-50 text-amber-950",
  "Content Pages": "border-teal-200 bg-teal-50 text-teal-950",
  "Low Priority / Legal": "border-slate-200 bg-slate-50 text-slate-700",
  Uncategorized: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

const TOKEN_STORAGE_PREFIX = "answerlint-bscan-token:";
const PROJECT_TOKEN_HEADER = "x-answerlint-project-token";

function tokenStorageKey(projectId: string) {
  return `${TOKEN_STORAGE_PREFIX}${projectId}`;
}

function readStoredToken(projectId: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(tokenStorageKey(projectId)) ?? undefined;
}

function storeToken(projectId: string, token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(tokenStorageKey(projectId), token);
}

export function BusinessAwareScanClient({
  initialBaseUrl = "",
  initialProjectId,
}: Props) {
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
  const [project, setProject] = useState<BusinessScanProject | null>(null);
  const [dashboard, setDashboard] = useState<BusinessScanDashboard | null>(null);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [fallbackMessage, setFallbackMessage] = useState("");
  const [error, setError] = useState("");
  const [isDiscovering, startDiscovery] = useTransition();
  const [isScanning, startScan] = useTransition();
  const [isLoadingProject, startProjectLoad] = useTransition();

  useEffect(() => {
    if (!initialProjectId) return;

    startProjectLoad(async () => {
      try {
        const storedToken = readStoredToken(initialProjectId);
        const response = await fetch(
          `/api/business-scan/projects/${initialProjectId}`,
          storedToken
            ? { headers: { [PROJECT_TOKEN_HEADER]: storedToken } }
            : undefined,
        );
        const payload = (await response.json()) as
          | { project: BusinessScanProject }
          | { error?: string };

        if (!response.ok || !("project" in payload)) {
          throw new Error(readPayloadError(payload, "Project could not be loaded."));
        }

        setProject(dedupeProjectPages(payload.project));
        setBaseUrl(payload.project.baseUrl);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Project could not be loaded.",
        );
      }
    });
  }, [initialProjectId]);

  useEffect(() => {
    if (!initialProjectId && initialBaseUrl) {
      setBaseUrl(initialBaseUrl);
    }
  }, [initialBaseUrl, initialProjectId]);

  useEffect(() => {
    if (!dashboard) return;

    window.requestAnimationFrame(() => {
      scrollToExecutiveDashboard();
    });
  }, [dashboard]);

  const scorePreview = useMemo(
    () => (project ? computeBusinessVisibilityScore(project.pages) : null),
    [project],
  );
  const reviewSummary = useMemo(
    () => (project ? summarizeReviewState(project.pages) : null),
    [project],
  );

  function handleDiscoverySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setDashboard(null);
    setProgress([]);
    setFallbackMessage("");

    startDiscovery(async () => {
      try {
        const response = await fetch("/api/business-scan/discover", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ baseUrl }),
        });

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error ?? "Discovery could not start.");
        }

        await readDiscoveryStream(response.body);
      } catch (discoverError) {
        setError(
          discoverError instanceof Error
            ? discoverError.message
            : "Discovery could not start.",
        );
      }
    });
  }

  async function readDiscoveryStream(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader();
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
        handleDiscoveryEvent(JSON.parse(line) as DiscoveryProgressEvent);
      }
    }
  }

  function handleDiscoveryEvent(event: DiscoveryProgressEvent) {
    if (event.type === "status") {
      setProgress((items) => [
        ...items.slice(-5),
        {
          message: event.message,
          pageCount: event.pageCount,
          groups: event.groups,
        },
      ]);
      return;
    }

    if (event.type === "fallback") {
      setFallbackMessage(event.message);
      return;
    }

    if (event.type === "project") {
      if (event.project.editToken) {
        storeToken(event.project.id, event.project.editToken);
      }
      setProject(dedupeProjectPages(event.project));
      setBaseUrl(event.project.baseUrl);
      setProgress((items) => [
        ...items,
        {
          message: "Business map ready",
          pageCount: event.project.pages.length,
          groups: groupCounts(event.project.pages),
        },
      ]);
      return;
    }

    setError(event.error);
  }

  function updateProjectPages(
    updater: (pages: BusinessScanPage[]) => BusinessScanPage[],
  ) {
    setProject((current) => {
      if (!current) return current;
      const next = {
        ...current,
        pages: updater(current.pages),
        updatedAt: new Date().toISOString(),
      };
      void persistProject(next);
      return next;
    });
  }

  function updatePage(
    pageId: string,
    patch: Partial<
      Pick<
        BusinessScanPage,
        "category" | "impactTier" | "included" | "is_manually_categorized"
      >
    >,
  ) {
    const locksIntent =
      patch.category !== undefined || patch.impactTier !== undefined;

    updateProjectPages((pages) =>
      pages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              ...patch,
              is_manually_categorized: locksIntent
                ? true
                : page.is_manually_categorized,
              included:
                patch.impactTier === "Ignored" ? false : patch.included ?? page.included,
            }
          : page,
      ),
    );
  }

  function applyCategoryBatch(
    category: BusinessCategory,
    patch: Partial<Pick<BusinessScanPage, "included" | "impactTier">>,
  ) {
    const locksIntent = patch.impactTier !== undefined;

    updateProjectPages((pages) =>
      pages.map((page) =>
        page.category === category
          ? {
              ...page,
              ...patch,
              included:
                patch.impactTier === "Ignored"
                  ? false
                  : patch.included ?? page.included,
              is_manually_categorized: locksIntent
                ? true
                : page.is_manually_categorized,
            }
          : page,
      ),
    );
  }

  async function persistProject(nextProject: BusinessScanProject) {
    const token = readStoredToken(nextProject.id);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token) headers[PROJECT_TOKEN_HEADER] = token;

    await fetch(`/api/business-scan/projects/${nextProject.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ project: nextProject }),
    }).catch(() => undefined);
  }

  function handleScan() {
    if (!project) return;
    setError("");

    startScan(async () => {
      try {
        const token = readStoredToken(project.id);
        const headers: Record<string, string> = {
          "content-type": "application/json",
        };
        if (token) headers[PROJECT_TOKEN_HEADER] = token;

        const response = await fetch("/api/business-scan/scan", {
          method: "POST",
          headers,
          body: JSON.stringify({ project }),
        });
        const payload = (await response.json()) as
          | { dashboard: BusinessScanDashboard }
          | { error?: string };

        if (!response.ok || !("dashboard" in payload)) {
          throw new Error(readPayloadError(payload, "Business-Aware Scan failed."));
        }

        setProject(dedupeProjectPages(payload.dashboard.project));
        setDashboard(payload.dashboard);
      } catch (scanError) {
        setError(
          scanError instanceof Error
            ? scanError.message
            : "Business-Aware Scan failed.",
        );
      }
    });
  }

  const canScan = Boolean(project && reviewSummary && !reviewSummary.hasNoIncludedPages);

  return (
    <div className="safe-pad mx-auto max-w-content py-10 sm:px-6 lg:px-8 lg:py-16">
      <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
            Business-Aware Scan
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            AnswerLint maps your website like a business, not a sitemap.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-muted">
            Then it shows which pages AI should understand first, what to exclude,
            and which visibility gaps are costing you the most.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleDiscoverySubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">
                Base URL
              </span>
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://example.com"
                inputMode="url"
                autoComplete="url"
                className="w-full rounded-2xl border border-border-strong bg-wash px-4 py-3 text-base text-ink outline-none transition focus:border-accent"
              />
            </label>
            <button
              type="submit"
              disabled={isDiscovering || !baseUrl.trim()}
              className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDiscovering ? "Mapping visibility..." : "Map My AI Visibility"}
            </button>
          </form>

          {error ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
        </div>

        <DiscoveryPanel
          isDiscovering={isDiscovering || isLoadingProject}
          progress={progress}
          fallbackMessage={fallbackMessage}
          project={project}
        />
      </section>

      {project && reviewSummary && scorePreview ? (
        <section className="mt-12 space-y-8">
          <ReviewSummary
            project={project}
            summary={reviewSummary}
            scoringMix={formatScoringMix(scorePreview.scoringMix)}
            excludedMessages={scorePreview.excludedCategoryMessages}
          />

          <Guardrails
            allIncludedVeryHigh={reviewSummary.allIncludedVeryHigh}
            tooFewPagesIncluded={reviewSummary.tooFewPagesIncluded}
            hasNoIncludedPages={reviewSummary.hasNoIncludedPages}
            excludedMessages={scorePreview.excludedCategoryMessages}
          />

          <div>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-display text-3xl font-semibold text-ink">
                  Which pages should AI understand first?
                </h2>
                <p className="mt-3 max-w-3xl text-base leading-7 text-ink-muted">
                  AnswerLint grouped your website into business areas. Review what
                  matters, exclude noise, and adjust impact before running your
                  Business-Aware Scan.
                </p>
              </div>
              <button
                type="button"
                disabled={!canScan || isScanning}
                onClick={handleScan}
                className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isScanning ? "Scanning current pages..." : "Run Business-Aware Scan"}
              </button>
            </div>

            <div className="mt-6 space-y-5">
              {BUSINESS_CATEGORIES.map((category) => (
                <CategoryCard
                  key={category}
                  category={category}
                  pages={project.pages.filter((page) => page.category === category)}
                  defaultOpen={category !== "Uncategorized"}
                  onBatch={applyCategoryBatch}
                  onUpdatePage={updatePage}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {dashboard ? <Dashboard dashboard={dashboard} onShowFixes={() => scrollToFixes()} /> : null}
    </div>
  );
}

function DiscoveryPanel({
  isDiscovering,
  progress,
  fallbackMessage,
  project,
}: {
  isDiscovering: boolean;
  progress: ProgressItem[];
  fallbackMessage: string;
  project: BusinessScanProject | null;
}) {
  const latest = progress.at(-1);

  return (
    <aside className="min-w-0 rounded-[24px] border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-accent">Business map</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">
            {latest?.message ?? "Ready to map"}
          </h2>
        </div>
        <div className="rounded-2xl border border-border bg-wash px-4 py-3 text-center">
          <p className="text-2xl font-semibold text-ink">
            {latest?.pageCount ?? project?.pages.length ?? 0}
          </p>
          <p className="text-xs font-medium text-ink-muted">pages</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {(progress.length ? progress : [{ message: "Enter a base URL to start.", pageCount: 0, groups: [] }]).map(
          (item, index) => (
            <div
              key={`${item.message}-${index}`}
              className="rounded-2xl border border-border bg-wash px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink">{item.message}</p>
                {isDiscovering && index === progress.length - 1 ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                ) : null}
              </div>
              {item.groups.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.groups.map((group) => (
                    <span
                      key={group.category}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${categoryTone[group.category]}`}
                    >
                      {group.category}: {group.count}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ),
        )}
      </div>

      {fallbackMessage ? (
        <button
          type="button"
          className="mt-4 w-full rounded-full border border-border-strong bg-paper px-4 py-3 text-sm font-semibold text-ink"
        >
          {fallbackMessage}
        </button>
      ) : null}

      {project?.storageStatus === "failed" ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Project is usable now, but Supabase storage failed: {project.storageError}
        </p>
      ) : null}
    </aside>
  );
}

function ReviewSummary({
  project,
  summary,
  scoringMix,
  excludedMessages,
}: {
  project: BusinessScanProject;
  summary: ReturnType<typeof summarizeReviewState>;
  scoringMix: ReturnType<typeof formatScoringMix>;
  excludedMessages: string[];
}) {
  return (
    <div className="rounded-[24px] border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold text-accent">Detected business model</p>
          <h2 className="mt-1 font-display text-3xl font-semibold text-ink">
            {project.businessModel}
          </h2>
          {project.storageStatus === "stored" ? (
            <p className="mt-3 text-sm text-ink-muted">
              Saved project:{" "}
              <Link
                href={`/tools/business-aware-scan?projectId=${project.id}`}
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                reload link
              </Link>
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="pages discovered" value={summary.totalPages} />
          <Metric label="included" value={summary.includedPages} />
          <Metric label="ignored" value={summary.ignoredPages} />
          <Metric label="need review" value={summary.pagesNeedingReview} />
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-5">
        <p className="text-sm font-semibold text-ink">Scoring Mix</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {scoringMix.map((item) => (
            <span
              key={item.category}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${categoryTone[item.category]}`}
            >
              {item.category.replace(" Pages", "")}: {item.label}
            </span>
          ))}
        </div>
        {excludedMessages.length ? (
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            {excludedMessages[0]}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Guardrails({
  allIncludedVeryHigh,
  tooFewPagesIncluded,
  hasNoIncludedPages,
  excludedMessages,
}: {
  allIncludedVeryHigh: boolean;
  tooFewPagesIncluded: boolean;
  hasNoIncludedPages: boolean;
  excludedMessages: string[];
}) {
  const messages = [
    allIncludedVeryHigh
      ? "All included pages are marked Very High. This makes pages equally important within their categories. Consider lowering supporting pages to improve prioritization."
      : "",
    tooFewPagesIncluded
      ? "Only a few pages are included. Your project score may not represent the full website."
      : "",
    hasNoIncludedPages
      ? "Include at least one page to run a Business-Aware Scan."
      : "",
    ...excludedMessages,
  ].filter(Boolean);

  if (!messages.length) return null;

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <p
          key={message}
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {message}
        </p>
      ))}
    </div>
  );
}

function CategoryCard({
  category,
  pages,
  defaultOpen,
  onBatch,
  onUpdatePage,
}: {
  category: BusinessCategory;
  pages: BusinessScanPage[];
  defaultOpen: boolean;
  onBatch: (
    category: BusinessCategory,
    patch: Partial<Pick<BusinessScanPage, "included" | "impactTier">>,
  ) => void;
  onUpdatePage: (
    pageId: string,
    patch: Partial<
      Pick<BusinessScanPage, "category" | "impactTier" | "included">
    >,
  ) => void;
}) {
  if (!pages.length && category === "Uncategorized") return null;

  return (
    <details
      className="rounded-[20px] border border-border bg-card shadow-soft"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-2xl font-semibold text-ink">
            {category}
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            {pages.length} page{pages.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BatchButton label="Include All" onClick={() => onBatch(category, { included: true })} />
          <BatchButton label="Exclude All" onClick={() => onBatch(category, { included: false })} />
          {(["Very High", "High", "Medium", "Low"] as BusinessImpactTier[]).map(
            (tier) => (
              <BatchButton
                key={tier}
                label={`All ${tier}`}
                onClick={() =>
                  onBatch(category, { impactTier: tier, included: true })
                }
              />
            ),
          )}
          <BatchButton
            label="Ignore all"
            onClick={() => onBatch(category, { impactTier: "Ignored", included: false })}
          />
        </div>
      </summary>

      <div className="border-t border-border">
        {pages.map((page, index) => (
          <PageRow
            key={`${page.id}-${index}`}
            page={page}
            onUpdatePage={onUpdatePage}
          />
        ))}
      </div>
    </details>
  );
}

function PageRow({
  page,
  onUpdatePage,
}: {
  page: BusinessScanPage;
  onUpdatePage: (
    pageId: string,
    patch: Partial<
      Pick<BusinessScanPage, "category" | "impactTier" | "included">
    >,
  ) => void;
}) {
  return (
    <div className="grid gap-4 border-b border-border px-5 py-4 last:border-b-0 xl:grid-cols-[1.3fr_0.9fr_0.9fr_1.3fr_auto] xl:items-center">
      <label className="flex min-w-0 items-start gap-3">
        <input
          type="checkbox"
          checked={page.included}
          onChange={(event) =>
            onUpdatePage(page.id, { included: event.target.checked })
          }
          className="mt-1 h-4 w-4 rounded border-border-strong text-accent"
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">
            {page.title}
          </span>
          <span className="mt-1 block truncate text-xs text-ink-muted">
            {page.url}
          </span>
          {page.is_manually_categorized ? (
            <span className="mt-1 inline-flex rounded-full bg-paper-muted px-2 py-0.5 text-xs font-medium text-ink-muted">
              Manual override locked
            </span>
          ) : null}
        </span>
      </label>

      <select
        value={page.category}
        onChange={(event) =>
          onUpdatePage(page.id, {
            category: event.target.value as BusinessCategory,
            included:
              event.target.value === "Low Priority / Legal" ||
              event.target.value === "Uncategorized"
                ? false
                : page.included,
          })
        }
        className="rounded-xl border border-border bg-wash px-3 py-2 text-sm text-ink"
      >
        {BUSINESS_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>

      <select
        value={page.impactTier}
        onChange={(event) =>
          onUpdatePage(page.id, {
            impactTier: event.target.value as BusinessImpactTier,
          })
        }
        className="rounded-xl border border-border bg-wash px-3 py-2 text-sm text-ink"
      >
        {IMPACT_TIERS.map((tier) => (
          <option key={tier} value={tier}>
            {tier}
          </option>
        ))}
      </select>

      <div className="min-w-0">
        <p className="text-sm leading-6 text-ink-muted">{page.reason}</p>
        <p className="mt-1 text-xs font-medium text-ink-muted">
          Confidence {Math.round(page.confidence * 100)}%
        </p>
      </div>

      <div className="flex gap-2 xl:justify-end">
        <button
          type="button"
          onClick={() =>
            onUpdatePage(page.id, { impactTier: "Ignored", included: false })
          }
          className="rounded-full border border-border-strong px-3 py-2 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
        >
          Ignore
        </button>
        <a
          href={page.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-paper-muted px-3 py-2 text-xs font-semibold text-ink transition hover:text-accent"
        >
          View
        </a>
      </div>
    </div>
  );
}

function Dashboard({
  dashboard,
  onShowFixes,
}: {
  dashboard: BusinessScanDashboard;
  onShowFixes: () => void;
}) {
  const { run } = dashboard;

  return (
    <section id="executive-dashboard" className="mt-12 scroll-mt-24 space-y-8">
      <div className="rounded-[24px] border border-border bg-ink p-5 text-white shadow-soft sm:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">
              Executive dashboard
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold">
              Business Visibility Score
            </h2>
          </div>
          <button
            type="button"
            onClick={onShowFixes}
            className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-paper-muted"
          >
            Show Me What To Fix First
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <DarkMetric label="Current Score" value={run.currentScore} />
          <DarkMetric label="Potential Score" value={run.potentialScore} />
          <DarkMetric label="Lost Opportunity" value={`+${run.lostOpportunityScore}`} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[20px] border border-border bg-card p-5 shadow-soft">
          <h3 className="font-display text-2xl font-semibold text-ink">
            Category Scores
          </h3>
          <div className="mt-4 space-y-3">
            {run.categoryScores
              .filter((category) => category.activeWeight > 0)
              .map((category) => (
                <div key={category.category}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-medium text-ink">{category.category}</span>
                    <span className="text-ink-muted">
                      {category.score} / {Math.round(category.activeWeight * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-muted">
                    <div
                      className="h-2 rounded-full bg-accent"
                      style={{
                        width: `${Math.min(100, Math.max(0, category.score))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div
          id="fix-first"
          className="rounded-[20px] border border-border bg-card p-5 shadow-soft"
        >
          <h3 className="font-display text-2xl font-semibold text-ink">
            Fix First
          </h3>
          <div className="mt-4 space-y-4">
            {run.recommendations.length ? (
              run.recommendations.map((recommendation, index) => (
                <div
                  key={recommendation.id}
                  className="rounded-2xl border border-border bg-wash p-4"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink text-balance">
                        {index + 1}. {recommendation.issue}
                      </p>
                      <p className="mt-1 truncate text-sm text-ink-muted">
                        {recommendation.pageName}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      <span className="whitespace-nowrap rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        +{recommendation.expectedScoreGain} points
                      </span>
                      <span className="whitespace-nowrap rounded-full bg-paper-muted px-3 py-1 text-xs font-semibold text-ink-muted">
                        {recommendation.effort}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink-muted">
                    {recommendation.suggestedAction}
                  </p>
                  <p className="mt-2 text-xs font-medium text-ink-muted">
                    Why: {recommendation.why}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-border bg-wash p-4 text-sm text-ink-muted">
                No immediate Fix First items were found for the pages that could be
                scanned.
              </p>
            )}
          </div>
        </div>
      </div>

      <details className="rounded-[20px] border border-border bg-card p-5 shadow-soft">
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          Technical Details
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-ink-muted">
              <tr>
                <th className="py-2 pr-4">Page</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-4">Project impact</th>
              </tr>
            </thead>
            <tbody>
              {run.pageScores.map((pageScore) => {
                const page = dashboard.project.pages.find(
                  (candidate) => candidate.id === pageScore.pageId,
                );

                return (
                  <tr key={pageScore.pageId} className="border-t border-border">
                    <td className="py-3 pr-4">{page?.title ?? pageScore.pageId}</td>
                    <td className="py-3 pr-4">{pageScore.category}</td>
                    <td className="py-3 pr-4">{pageScore.pageScore}</td>
                    <td className="py-3 pr-4">
                      {(pageScore.projectWeight * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-wash px-4 py-3">
      <p className="text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </p>
    </div>
  );
}

function DarkMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
      <p className="text-4xl font-semibold">{value}</p>
      <p className="mt-2 text-sm font-medium text-white/70">{label}</p>
    </div>
  );
}

function BatchButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      className="rounded-full border border-border-strong bg-wash px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
    >
      {label}
    </button>
  );
}

function groupCounts(pages: BusinessScanPage[]) {
  return BUSINESS_CATEGORIES.map((category) => ({
    category,
    count: pages.filter((page) => page.category === category).length,
  })).filter((group) => group.count > 0);
}

function dedupeProjectPages(project: BusinessScanProject): BusinessScanProject {
  const pages = project.pages.filter(
    (page, index, allPages) =>
      allPages.findIndex(
        (candidate) => candidate.id === page.id || candidate.url === page.url,
      ) === index,
  );

  return {
    ...project,
    pages,
    discoveredUrls: pages.map((page) => page.url),
  };
}

function scrollToFixes() {
  document.getElementById("fix-first")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function scrollToExecutiveDashboard() {
  document.getElementById("executive-dashboard")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function readPayloadError(payload: unknown, fallback: string) {
  return typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
    ? payload.error
    : fallback;
}
