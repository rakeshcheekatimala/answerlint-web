"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  LeadershipReport,
  ReportContract,
} from "@/components/visibility/LeadershipReport";
import {
  buildVisibilityWorkspaceReport,
  type VisibilityWorkspaceReport,
} from "@/lib/visibility/reporting";
import {
  defaultRuntimePolicy,
  visibilityIntakeSchema,
  type VisibilityIntake,
} from "@/lib/visibility/schema";
import { applyProjectApprovals } from "@/lib/visibility/lifecycle";
import {
  DEFAULT_VISIBILITY_BASELINE_RUNS,
  MAX_VISIBILITY_RUNS_PER_BENCHMARK,
  VISIBILITY_PROJECT_TOKEN_HEADER,
} from "@/lib/visibility/constants";
import {
  VISIBILITY_SURFACE_DEFINITIONS,
  type VisibilityProject,
  type VisibilitySurface,
} from "@/lib/visibility/types";

type Props = { initialProjectId?: string };
type WorkspaceView =
  | "overview"
  | "portfolio"
  | "evidence"
  | "sources"
  | "actions"
  | "settings";

const TOKEN_STORAGE_PREFIX = "answerlint-visibility-token:";
const inputClass =
  "mt-2 w-full rounded-xl border border-border bg-paper px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-ink focus:ring-4 focus:ring-ink/5";
const cardClass = "rounded-2xl border border-border bg-card shadow-soft";
const surfaceById = new Map(
  VISIBILITY_SURFACE_DEFINITIONS.map((surface) => [surface.surface, surface]),
);

function defaultValues(): VisibilityIntake {
  return {
    brandUrl: "",
    brandName: "",
    description: "",
    primaryCategory: "",
    targetCustomers: "",
    keyUseCases: [],
    revenueGoal: "pipeline",
    competitors: [],
    markets: ["US"],
    languages: ["en"],
    surfaces: ["chatgpt_search"],
    runtimePolicy: defaultRuntimePolicy(),
  };
}

function tokenStorageKey(projectId: string) {
  return `${TOKEN_STORAGE_PREFIX}${projectId}`;
}

function readToken(projectId: string) {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(tokenStorageKey(projectId)) ?? undefined;
}

export function VisibilityWorkspaceClient({ initialProjectId }: Props) {
  const [project, setProject] = useState<VisibilityProject | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadedReport, setLoadedReport] =
    useState<VisibilityWorkspaceReport | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>("overview");
  const [useCasesText, setUseCasesText] = useState("");
  const [isSubmitting, startSubmit] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [isQueueing, startQueue] = useTransition();
  const form = useForm<VisibilityIntake>({
    resolver: zodResolver(visibilityIntakeSchema),
    defaultValues: defaultValues(),
  });
  const competitors = useFieldArray({
    control: form.control,
    name: "competitors",
  });
  const markets = form.watch("markets");
  const surfaces = form.watch("surfaces");
  const repeats = form.watch("runtimePolicy.repeatRuns");
  const plannedDraftRuns = Math.max(1, 8 * surfaces.length * repeats);
  const plannedReport = useMemo(
    () => (project ? buildVisibilityWorkspaceReport(project) : null),
    [project],
  );
  const workspaceReport = loadedReport ?? plannedReport;

  const loadReport = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/visibility/projects/${projectId}/report`);
      const payload = (await response.json()) as {
        report?: VisibilityWorkspaceReport;
      };
      if (response.ok && payload.report) setLoadedReport(payload.report);
    } catch {
      // The local plan remains useful until durable evidence is available.
    }
  }, []);

  const loadProject = useCallback(
    async (projectId: string, legacyToken?: string) => {
      try {
        const response = await fetch(`/api/visibility/projects/${projectId}`, {
          headers: legacyToken
            ? { [VISIBILITY_PROJECT_TOKEN_HEADER]: legacyToken }
            : undefined,
        });
        const payload = (await response.json()) as {
          project?: VisibilityProject;
          error?: string;
        };
        if (!response.ok || !payload.project)
          throw new Error(payload.error ?? "Project could not be loaded.");
        setProject(payload.project);
        if (legacyToken) window.localStorage.removeItem(tokenStorageKey(projectId));
        void loadReport(projectId);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Project could not be loaded.",
        );
      }
    },
    [loadReport],
  );

  useEffect(() => {
    if (!initialProjectId) return;
    const token = readToken(initialProjectId);
    void loadProject(initialProjectId, token);
  }, [initialProjectId, loadProject]);

  useEffect(() => {
    if (
      !project || !["benchmark_queued", "benchmarking"].includes(project.state)
    )
      return;
    const timer = window.setInterval(
      () => void loadProject(project.id),
      8_000,
    );
    return () => window.clearInterval(timer);
  }, [loadProject, project]);

  function updateUseCases(value: string) {
    setUseCasesText(value);
    form.setValue(
      "keyUseCases",
      value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      { shouldValidate: true },
    );
  }

  function toggleMarket(market: string) {
    const next = markets.includes(market)
      ? markets.filter((item) => item !== market)
      : [...markets, market];
    form.setValue("markets", next.length ? next : [market], {
      shouldValidate: true,
    });
  }

  function toggleSurface(surface: VisibilitySurface) {
    const definition = surfaceById.get(surface);
    if (!definition || definition.availability !== "available") return;
    const next = surfaces.includes(surface)
      ? surfaces.filter((item) => item !== surface)
      : [...surfaces, surface];
    form.setValue("surfaces", next.length ? next : [surface], {
      shouldValidate: true,
    });
  }

  function handleCreate(values: VisibilityIntake) {
    setError("");
    setNotice("");
    startSubmit(async () => {
      try {
        const response = await fetch("/api/visibility/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(values),
        });
        const payload = (await response.json()) as {
          project?: VisibilityProject;
          error?: string;
        };
        if (!response.ok || !payload.project)
          throw new Error(payload.error ?? "Workspace could not be created.");
        setProject(payload.project);
        setLoadedReport(null);
        setActiveView("overview");
        if (payload.project.storageStatus === "stored") {
          window.history.replaceState(
            null,
            "",
            `/tools/ai-visibility?projectId=${payload.project.id}`,
          );
        }
        setNotice(
          payload.project.storageStatus === "stored"
            ? "Report created. Approve the brand and questions before any runs start."
            : "Report created for this browser session. Connect Supabase to keep it across devices.",
        );
      } catch (createError) {
        setError(
          createError instanceof Error
            ? createError.message
            : "Workspace could not be created.",
        );
      }
    });
  }

  function persistApproval(
    next: VisibilityProject,
    approval: unknown,
    successMessage: string,
  ) {
    setError("");
    setNotice("");
    startSave(async () => {
      try {
        if (next.storageStatus !== "stored") {
          setProject(next);
          setLoadedReport(null);
          setNotice(
            `${successMessage} Connect Supabase before using a durable benchmark.`,
          );
          return;
        }
        const response = await fetch(`/api/visibility/projects/${next.id}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(approval),
        });
        const payload = (await response.json()) as {
          project?: VisibilityProject;
          error?: string;
        };
        if (!response.ok || !payload.project)
          throw new Error(payload.error ?? "Approval could not be saved.");
        setProject(payload.project);
        setLoadedReport(null);
        setNotice(successMessage);
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Approval could not be saved.",
        );
      }
    });
  }

  function approveBrandCard() {
    if (!project) return;
    persistApproval(
      applyProjectApprovals(project, { brandCard: true }),
      { brandCard: true },
      "Entity baseline approved. Review the benchmark cohort next.",
    );
  }

  function approveTopics() {
    if (!project) return;
    const topicIds = project.topics
      .filter((topic) => topic.included)
      .map((topic) => topic.id);
    if (!topicIds.length) {
      setError("Keep at least one topic in the benchmark cohort.");
      return;
    }
    const prompts = project.prompts.map(({ id, text, included }) => ({
      id,
      text,
      included,
    }));
    if (
      !prompts.some(
        (prompt) =>
          prompt.included &&
          topicIds.includes(
            project.prompts.find((item) => item.id === prompt.id)?.topicId ??
              "",
          ),
      )
    ) {
      setError("Keep at least one clear prompt in an included topic.");
      return;
    }
    const approval = { topicIds, prompts };
    persistApproval(
      applyProjectApprovals(project, approval),
      approval,
      "Benchmark cohort locked. It is ready for a controlled run.",
    );
  }

  function toggleTopic(topicId: string) {
    setProject((current) =>
      current
        ? {
            ...current,
            topics: current.topics.map((topic) =>
              topic.id === topicId
                ? { ...topic, included: !topic.included }
                : topic,
            ),
          }
        : current,
    );
  }

  function updatePrompt(
    promptId: string,
    update: { text?: string; included?: boolean },
  ) {
    setProject((current) =>
      current
        ? {
            ...current,
            prompts: current.prompts.map((prompt) =>
              prompt.id === promptId ? { ...prompt, ...update } : prompt,
            ),
          }
        : current,
    );
  }

  function queueBenchmark() {
    if (!project) return;
    if (project.storageStatus !== "stored") {
      setError("Connect Supabase storage before running a durable benchmark.");
      return;
    }
    setError("");
    setNotice("");
    startQueue(async () => {
      try {
        const response = await fetch(
          `/api/visibility/projects/${project.id}/benchmark`,
          {
            method: "POST",
          },
        );
        const payload = (await response.json()) as {
          project?: VisibilityProject;
          error?: string;
        };
        if (!response.ok || !payload.project)
          throw new Error(payload.error ?? "Benchmark could not be queued.");
        setProject(payload.project);
        setLoadedReport(null);
        setNotice(
          "Controlled benchmark queued. The workspace will refresh as answer and source evidence arrives.",
        );
      } catch (queueError) {
        setError(
          queueError instanceof Error
            ? queueError.message
            : "Benchmark could not be queued.",
        );
      }
    });
  }

  return (
    <main
      id="main-content"
      className="safe-pad mx-auto max-w-content py-7 sm:px-6 lg:px-8 lg:py-10"
    >
      {!project ? (
        <SetupScreen
          form={form}
          competitors={competitors}
          useCasesText={useCasesText}
          surfaces={surfaces}
          markets={markets}
          repeats={repeats}
          plannedDraftRuns={plannedDraftRuns}
          isSubmitting={isSubmitting}
          onSubmit={handleCreate}
          onUseCasesChange={updateUseCases}
          onToggleMarket={toggleMarket}
          onToggleSurface={toggleSurface}
        />
      ) : workspaceReport ? (
        <Workspace
          project={project}
          report={workspaceReport}
          activeView={activeView}
          isSaving={isSaving}
          isQueueing={isQueueing}
          onViewChange={setActiveView}
          onApproveBrand={approveBrandCard}
          onApproveTopics={approveTopics}
          onToggleTopic={toggleTopic}
          onUpdatePrompt={updatePrompt}
          onQueue={queueBenchmark}
          onReset={() => {
            setProject(null);
            setLoadedReport(null);
            setActiveView("overview");
          }}
        />
      ) : null}
      {error ? <Feedback tone="error" message={error} /> : null}
      {notice ? <Feedback tone="notice" message={notice} /> : null}
    </main>
  );
}

function SetupScreen({
  form,
  competitors,
  useCasesText,
  surfaces,
  markets,
  repeats,
  plannedDraftRuns,
  isSubmitting,
  onSubmit,
  onUseCasesChange,
  onToggleMarket,
  onToggleSurface,
}: {
  form: ReturnType<typeof useForm<VisibilityIntake>>;
  competitors: ReturnType<
    typeof useFieldArray<VisibilityIntake, "competitors">
  >;
  useCasesText: string;
  surfaces: VisibilitySurface[];
  markets: string[];
  repeats: number;
  plannedDraftRuns: number;
  isSubmitting: boolean;
  onSubmit: (values: VisibilityIntake) => void;
  onUseCasesChange: (value: string) => void;
  onToggleMarket: (market: string) => void;
  onToggleSurface: (surface: VisibilitySurface) => void;
}) {
  return (
    <>
      <section className="overflow-hidden rounded-[1.5rem] border border-ink bg-ink px-5 py-8 text-paper shadow-[0_26px_70px_rgba(10,10,10,0.18)] sm:px-8 lg:px-10 lg:py-11">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-score-high">
          <PulseIcon /> AI visibility report
        </div>
        <h1 className="mt-5 max-w-4xl font-display text-4xl font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl">
          Why answers cite your competitors.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
          One page: your citation share, the buyer prompts where you are
          missing, a technical check, and five fixes. Each question is asked
          again, because a single answer changes from run to run.
        </p>
      </section>
      <ReportContract />

      <section className={`${cardClass} mt-6 overflow-hidden`}>
        <div className="border-b border-border bg-paper-muted px-5 py-5 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">
                Start the report
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
                Name the brand and the competitors to compare.
              </h2>
            </div>
            <div className="rounded-xl border border-border bg-paper px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Planned runs
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-ink">
                {plannedDraftRuns} runs
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {`Up to 8 questions, each asked ${repeats} time${repeats === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
        </div>
        <form className="p-5 sm:p-8" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-x-5 gap-y-6 lg:grid-cols-2">
            <Field
              label="Brand URL"
              error={form.formState.errors.brandUrl?.message}
            >
              <input
                aria-label="Brand URL"
                className={inputClass}
                placeholder="https://example.com"
                autoComplete="url"
                {...form.register("brandUrl")}
              />
            </Field>
            <Field
              label="Brand name"
              error={form.formState.errors.brandName?.message}
            >
              <input
                aria-label="Brand name"
                className={inputClass}
                placeholder="AnswerLint"
                autoComplete="organization"
                {...form.register("brandName")}
              />
            </Field>
            <Field
              label="Category or product"
              error={form.formState.errors.primaryCategory?.message}
            >
              <input
                aria-label="Category or product"
                className={inputClass}
                placeholder="Compliance automation software"
                {...form.register("primaryCategory")}
              />
            </Field>
            <Field
              label="Primary customer"
              error={form.formState.errors.targetCustomers?.message}
            >
              <input
                aria-label="Primary customer"
                className={inputClass}
                placeholder="Mid-market SaaS security teams"
                {...form.register("targetCustomers")}
              />
            </Field>
            <div className="lg:col-span-2">
              <Field
                label="Buyer questions"
                hint="One job per line. These become the prompts the report scores."
                error={
                  form.formState.errors.keyUseCases?.message as
                    | string
                    | undefined
                }
              >
                <textarea
                  aria-label="Buyer questions"
                  className={inputClass}
                  rows={3}
                  value={useCasesText}
                  onChange={(event) => onUseCasesChange(event.target.value)}
                  placeholder={
                    "prepare for SOC 2\ncompare compliance automation tools"
                  }
                />
              </Field>
            </div>
            <div className="lg:col-span-2">
              <Field
                label="How the answers are collected"
                hint="ChatGPT, Perplexity, and Gemini screenshots are left out. A picture of one answer changes on the next run and does not show citation share."
              >
                {VISIBILITY_SURFACE_DEFINITIONS.filter(
                  (surface) => surface.availability === "available",
                ).length > 1 ? (
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    {VISIBILITY_SURFACE_DEFINITIONS.map((surface) => {
                      const selected = surfaces.includes(surface.surface);
                      return (
                        <button
                          key={surface.surface}
                          type="button"
                          onClick={() => onToggleSurface(surface.surface)}
                          className={`group relative min-h-28 rounded-xl border p-4 text-left transition ${selected ? "border-ink bg-ink text-white" : "border-border bg-paper hover:border-ink"}`}
                          aria-pressed={selected}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="font-semibold">{surface.label}</span>
                          </div>
                          <p
                            className={`mt-2 text-xs leading-5 ${selected ? "text-white/65" : "text-ink-muted"}`}
                          >
                            {surface.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 rounded-xl border border-border bg-paper px-4 py-3 text-sm leading-6 text-ink">
                    {`Repeated OpenAI web-search runs. The same questions are asked ${repeats} time${repeats === 1 ? "" : "s"}, and only sources that resolve are counted.`}
                  </p>
                )}
              </Field>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Markets</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["US", "GB", "SG", "AU", "DE"].map((market) => (
                  <button
                    key={market}
                    type="button"
                    onClick={() => onToggleMarket(market)}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${markets.includes(market) ? "border-ink bg-ink text-white" : "border-border bg-paper text-ink-muted hover:border-ink"}`}
                    aria-pressed={markets.includes(market)}
                  >
                    {market}
                  </button>
                ))}
              </div>
            </div>
            <Field
              label="Repeats"
              hint="Each question is asked this many times. Three is the default, because one answer changes."
            >
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="rounded-xl border border-border bg-paper p-3 text-xs font-semibold text-ink">
                  Times per question
                  <select
                    aria-label="Times per question"
                    className="mt-2 w-full bg-transparent text-sm font-semibold outline-none"
                    value={repeats}
                    onChange={(event) =>
                      form.setValue(
                        "runtimePolicy.repeatRuns",
                        Number(event.target.value),
                        { shouldValidate: true },
                      )
                    }
                  >
                    <option value={1}>1</option>
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                  </select>
                </label>
                <div className="rounded-xl border border-border bg-paper p-3 text-xs font-semibold text-ink">
                  Sources
                  <p className="mt-2 text-sm font-semibold">
                    Web search stays on, so answers can cite pages.
                  </p>
                </div>
              </div>
            </Field>
            <div className="lg:col-span-2 rounded-xl border border-border bg-paper-muted p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    Competitors to compare
                  </p>
                  <p className="mt-1 text-xs leading-5 text-ink-muted">
                    Citation share is split across these names. Add a site so
                    their citations can be matched. Nothing is added for you.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => competitors.append({ name: "", url: "" })}
                  className="rounded-lg border border-border-strong bg-paper px-3 py-2 text-xs font-bold text-ink hover:border-ink"
                >
                  + Add competitor
                </button>
              </div>
              {competitors.fields.length ? (
                <div className="mt-4 space-y-3">
                  {competitors.fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                    >
                      <input
                        aria-label={`Competitor ${index + 1} name`}
                        className="rounded-lg border border-border bg-paper px-3 py-2.5 text-sm outline-none focus:border-ink"
                        placeholder="Competitor name"
                        {...form.register(`competitors.${index}.name`)}
                      />
                      <input
                        aria-label={`Competitor ${index + 1} URL`}
                        className="rounded-lg border border-border bg-paper px-3 py-2.5 text-sm outline-none focus:border-ink"
                        placeholder="https://competitor.com"
                        {...form.register(`competitors.${index}.url`)}
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-ink-muted hover:border-ink hover:text-ink"
                        onClick={() => competitors.remove(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
            <p className="max-w-xl text-sm leading-6 text-ink-muted">
              {`You approve the questions before anything is sent. The first report uses ${DEFAULT_VISIBILITY_BASELINE_RUNS} runs and stops at ${MAX_VISIBILITY_RUNS_PER_BENCHMARK}.`}
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Creating report…" : "Create the report"}
              <ArrowIcon />
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function Workspace({
  project,
  report,
  activeView,
  isSaving,
  isQueueing,
  onViewChange,
  onApproveBrand,
  onApproveTopics,
  onToggleTopic,
  onUpdatePrompt,
  onQueue,
  onReset,
}: {
  project: VisibilityProject;
  report: VisibilityWorkspaceReport;
  activeView: WorkspaceView;
  isSaving: boolean;
  isQueueing: boolean;
  onViewChange: (view: WorkspaceView) => void;
  onApproveBrand: () => void;
  onApproveTopics: () => void;
  onToggleTopic: (id: string) => void;
  onUpdatePrompt: (
    id: string,
    update: { text?: string; included?: boolean },
  ) => void;
  onQueue: () => void;
  onReset: () => void;
}) {
  const canRun =
    project.state === "ready_to_benchmark" &&
    project.storageStatus === "stored";
  const runCta = benchmarkCta(project, canRun);
  return (
    <>
      <section className="overflow-hidden rounded-[1.5rem] border border-ink bg-ink text-white shadow-[0_24px_65px_rgba(10,10,10,0.18)]">
        <div className="border-b border-white/10 px-5 py-3 text-xs text-white/55 sm:px-7">
          <span className="font-mono text-score-high">REPEATED RUNS</span>
          <span className="mx-2 text-white/20">/</span>
          Same questions, asked more than once. Citation share uses sources that resolve.
        </div>
        <div className="flex flex-col gap-5 px-5 py-6 sm:px-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-score-high">
                {project.intake.primaryCategory}
              </p>
              <StatusPill state={project.state} />
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              {project.intake.brandName}{" "}
              <span className="text-white/45">visibility report</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              {report.leadership.headline}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg border border-white/20 px-3.5 py-2.5 text-xs font-bold text-white/80 hover:bg-white/10"
            >
              New report
            </button>
            <button
              type="button"
              onClick={onQueue}
              disabled={!canRun || isQueueing}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors duration-200 motion-reduce:transition-none ${
                canRun
                  ? "bg-score-high text-ink hover:bg-[#d9ff45]"
                  : "cursor-not-allowed border border-white/15 bg-white/[0.04] text-white/45"
              }`}
            >
              {isQueueing ? "Queueing run…" : runCta}
              <ArrowIcon />
            </button>
          </div>
        </div>
      </section>
      <WorkspaceLifecycle project={project} />
      {project.benchmarkProgress &&
      ["benchmark_queued", "benchmarking", "failed"].includes(project.state) ? (
        <RunProgress progress={project.benchmarkProgress} />
      ) : null}
      <section className={`${cardClass} mt-5 overflow-hidden`}>
        <WorkspaceNav
          activeView={activeView}
          onViewChange={onViewChange}
          report={report}
        />
        <div className="p-5 sm:p-7">
          {activeView === "overview" ? (
            <OverviewPanel report={report} onViewChange={onViewChange} />
          ) : null}
          {activeView === "portfolio" ? (
            <PortfolioPanel
              project={project}
              report={report}
              isSaving={isSaving}
              onApproveBrand={onApproveBrand}
              onApproveTopics={onApproveTopics}
              onToggleTopic={onToggleTopic}
              onUpdatePrompt={onUpdatePrompt}
            />
          ) : null}
          {activeView === "evidence" ? (
            <EvidencePanel
              report={report}
              project={project}
              isQueueing={isQueueing}
              onQueue={onQueue}
            />
          ) : null}
          {activeView === "sources" ? <SourcesPanel report={report} /> : null}
          {activeView === "actions" ? <ActionsPanel report={report} /> : null}
          {activeView === "settings" ? (
            <SettingsPanel project={project} report={report} />
          ) : null}
        </div>
      </section>
    </>
  );
}

function WorkspaceLifecycle({ project }: { project: VisibilityProject }) {
  const measurementActive = ["ready_to_benchmark", "benchmark_queued", "benchmarking", "failed"].includes(
    project.state,
  );
  const currentIndex = project.state === "completed" ? 3 : measurementActive ? 2 : 1;
  const steps = ["Scope", "Approve", "Measure", "Decide"];
  const isLive = ["benchmark_queued", "benchmarking"].includes(project.state);
  const copy = lifecycleCopy(project);

  return (
    <section
      aria-live="polite"
      className="mt-4 border-y border-border bg-paper px-4 py-4 sm:px-6"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.8fr)] lg:items-center">
        <ol className="grid grid-cols-4 gap-2" aria-label="Benchmark lifecycle">
          {steps.map((step, index) => {
            const state = index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
            return (
              <li key={step} className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full transition-colors duration-200 motion-reduce:transition-none ${
                      state === "complete"
                        ? "bg-emerald-500"
                        : state === "current"
                          ? `bg-ink ${isLive ? "animate-pulse motion-reduce:animate-none" : ""}`
                          : "bg-border-strong"
                    }`}
                  />
                  <span
                    className={`truncate text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none ${
                      state === "upcoming" ? "text-ink-subtle" : "text-ink"
                    }`}
                  >
                    {step}
                  </span>
                </div>
                <div
                  className={`mt-2 h-px transition-colors duration-300 motion-reduce:transition-none ${
                    state === "upcoming" ? "bg-border" : "bg-ink"
                  }`}
                />
              </li>
            );
          })}
        </ol>
        <div className="lg:border-l lg:border-border lg:pl-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
            {copy.label}
          </p>
          <p className="mt-1 text-sm font-medium leading-6 text-ink">{copy.message}</p>
        </div>
      </div>
    </section>
  );
}

function lifecycleCopy(project: VisibilityProject) {
  switch (project.state) {
    case "awaiting_brand_approval":
      return {
        label: "Your next decision",
        message:
          "Confirm the entity and approved voice claim. No provider calls have been made.",
      };
    case "awaiting_topic_approval":
      return {
        label: "Your next decision",
        message:
          "Edit or discard unclear buyer questions, then lock the cohort. No provider calls have been made.",
      };
    case "ready_to_benchmark":
      return project.storageStatus === "stored"
        ? {
            label: "Ready to measure",
            message:
              "The cohort is locked. Start the controlled benchmark when you are ready to spend the displayed run budget.",
          }
        : {
            label: "Blocked before measurement",
            message:
              "The cohort is locked, but durable storage is not connected. Configure Supabase before running.",
          };
    case "benchmark_queued":
      return {
        label: "Queued",
        message:
          project.benchmarkProgress?.message ??
          "The benchmark is waiting for a worker. The page refreshes as evidence arrives.",
      };
    case "benchmarking":
      return {
        label: "Measurement in progress",
        message:
          project.benchmarkProgress?.message ??
          "Provider answers are being collected and their cited sources verified.",
      };
    case "failed":
      return {
        label: "Measurement needs attention",
        message:
          project.benchmarkProgress?.message ??
          "The run stopped. Completed evidence remains preserved for diagnosis.",
      };
    case "completed":
      return {
        label: "Ready for a decision",
        message:
          "Measurement and verification are complete. Review the evidence-backed action queue; unsupported ideas remain excluded.",
      };
  }
}

function WorkspaceNav({
  activeView,
  onViewChange,
  report,
}: {
  activeView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  report: VisibilityWorkspaceReport;
}) {
  const tabs: Array<{ id: WorkspaceView; label: string; count?: number }> = [
    { id: "overview", label: "Report" },
    { id: "portfolio", label: "Portfolio" },
    {
      id: "evidence",
      label: "Evidence",
      count: report.measurementCoverage.completedRuns,
    },
    { id: "sources", label: "Sources", count: report.sourceRows.length },
    { id: "actions", label: "Actions", count: report.actions.length },
    { id: "settings", label: "Method" },
  ];
  return (
    <nav
      className="flex overflow-x-auto border-b border-border px-3 pt-3 sm:px-5"
      aria-label="Workspace views"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onViewChange(tab.id)}
          className={`relative shrink-0 px-3 py-3 text-sm font-semibold transition ${activeView === tab.id ? "text-ink" : "text-ink-muted hover:text-ink"}`}
        >
          <span className="inline-flex items-center gap-2">
            {tab.label}
            {tab.count !== undefined ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono ${activeView === tab.id ? "bg-ink text-white" : "bg-paper-muted text-ink-muted"}`}
              >
                {tab.count}
              </span>
            ) : null}
          </span>
          {activeView === tab.id ? (
            <span className="absolute inset-x-3 bottom-0 h-0.5 bg-ink" />
          ) : null}
        </button>
      ))}
    </nav>
  );
}

function OverviewPanel({
  report,
  onViewChange,
}: {
  report: VisibilityWorkspaceReport;
  onViewChange: (view: WorkspaceView) => void;
}) {
  const analysis = report.crewAnalysis;
  return (
    <div className="space-y-8">
      <LeadershipReport page={report.leadership} />
      <div className="flex flex-wrap gap-2 border-t border-border pt-5">
        <button
          type="button"
          onClick={() => onViewChange("actions")}
          className="rounded-lg bg-ink px-3.5 py-2.5 text-xs font-bold text-white"
        >
          Open the full fix list
        </button>
        <button
          type="button"
          onClick={() => onViewChange("evidence")}
          className="rounded-lg border border-border-strong px-3.5 py-2.5 text-xs font-bold text-ink"
        >
          Inspect answers
        </button>
      </div>
      {analysis ? (
        <details className="rounded-xl border border-border bg-paper px-4 py-3">
          <summary className="cursor-pointer text-xs font-bold text-ink">
            How this reading was produced
          </summary>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-ink">{analysis.executiveHeadline}</p>
              <p className="mt-2 text-sm leading-6 text-ink-muted">{analysis.executiveSummary}</p>
            </div>
            {analysis.brandVoice.map((finding) => (
              <Lane
                key={finding.dimension}
                name={finding.dimension}
                state={finding.status.replace("_", " ")}
                body={finding.observed}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function PortfolioPanel({
  project,
  report,
  isSaving,
  onApproveBrand,
  onApproveTopics,
  onToggleTopic,
  onUpdatePrompt,
}: {
  project: VisibilityProject;
  report: VisibilityWorkspaceReport;
  isSaving: boolean;
  onApproveBrand: () => void;
  onApproveTopics: () => void;
  onToggleTopic: (id: string) => void;
  onUpdatePrompt: (
    id: string,
    update: { text?: string; included?: boolean },
  ) => void;
}) {
  const brandApproved = project.brandCard.approvalStatus === "approved";
  const cohortLocked =
    project.state === "ready_to_benchmark" ||
    ["benchmark_queued", "benchmarking", "completed"].includes(project.state);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <article className="rounded-2xl border border-border bg-paper p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
                1 · Entity baseline
              </p>
              <h2 className="mt-2 font-display text-xl font-semibold text-ink">
                {project.brandCard.canonicalName}
              </h2>
            </div>
            <ApprovalBadge approved={brandApproved} />
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <Definition
              label="Approved voice claim"
              value={project.brandCard.valueProposition}
            />
            <Definition
              label="ICP"
              value={project.brandCard.idealCustomerProfile}
            />
            <Definition
              label="Primary asset"
              value={
                project.brandCard.initialOwnedAssets[0]?.url ??
                project.intake.brandUrl
              }
            />
          </dl>
          <button
            type="button"
            disabled={brandApproved || isSaving}
            onClick={onApproveBrand}
            className="mt-5 w-full rounded-lg bg-ink px-3 py-2.5 text-xs font-bold text-white disabled:opacity-45"
          >
            {brandApproved
              ? "Baseline approved"
              : isSaving
                ? "Saving…"
                : "Approve entity baseline"}
          </button>
        </article>
        <article className="rounded-2xl border border-border bg-paper p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
                2 · Benchmark cohort
              </p>
              <h2 className="mt-2 font-display text-xl font-semibold text-ink">
                Keep only questions a real buyer would ask.
              </h2>
            </div>
            <div className="rounded-lg bg-paper-muted px-3 py-2 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                Run plan
              </p>
              <p className="font-mono text-sm font-semibold text-ink">
                {report.measurementCoverage.plannedRuns} planned
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {project.topics.map((topic) => (
              <label
                key={topic.id}
                className={`grid cursor-pointer grid-cols-[auto_1fr_auto] gap-3 rounded-xl border p-3 transition-colors duration-200 motion-reduce:transition-none ${topic.included ? "border-border bg-paper shadow-[inset_3px_0_0_var(--color-ink)]" : "border-border bg-paper-muted text-ink-muted"}`}
              >
                <input
                  type="checkbox"
                  disabled={cohortLocked}
                  checked={topic.included}
                  onChange={() => onToggleTopic(topic.id)}
                  className="mt-1 h-4 w-4 accent-[var(--color-ink)]"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">
                    {topic.statement}
                  </span>
                  <span className="mt-1 block text-xs text-ink-muted">
                    {topic.buyerIntent} · {topic.funnelStage} ·{" "}
                    {topic.commercialValue} value
                  </span>
                </span>
                <span className="font-mono text-xs text-ink-muted">
                  {topic.promptCount} {topic.promptCount === 1 ? "run" : "runs"}
                </span>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={!brandApproved || cohortLocked || isSaving}
            onClick={onApproveTopics}
            className="mt-5 w-full rounded-lg bg-ink px-3 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {cohortLocked
              ? "Cohort locked"
              : isSaving
                ? "Saving…"
                : "Lock approved cohort"}
          </button>
          {!brandApproved ? (
            <p className="mt-2 text-xs text-ink-muted">
              Approve the entity baseline before locking this cohort.
            </p>
          ) : null}
        </article>
      </div>
      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
              Prompt portfolio
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
              Edit or discard unclear prompts before spending a provider call.
            </h2>
          </div>
          <span className="font-mono text-xs text-ink-muted">
            v1 · locked on approval
          </span>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          {project.prompts
            .filter(
              (prompt) =>
                project.topics.find((topic) => topic.id === prompt.topicId)
                  ?.included,
            )
            .map((prompt) => (
              <article
                key={prompt.id}
                className={`grid gap-3 border-b border-border p-4 last:border-0 sm:grid-cols-[auto_1fr_auto] ${prompt.included ? "bg-paper" : "bg-paper-muted opacity-65"}`}
              >
                <input
                  aria-label={`Include prompt: ${prompt.text}`}
                  type="checkbox"
                  disabled={cohortLocked}
                  checked={prompt.included}
                  onChange={() =>
                    onUpdatePrompt(prompt.id, { included: !prompt.included })
                  }
                  className="mt-3 h-4 w-4 accent-[var(--color-ink)]"
                />
                <div>
                  <textarea
                    aria-label="Benchmark prompt"
                    disabled={cohortLocked || !prompt.included}
                    value={prompt.text}
                    onChange={(event) =>
                      onUpdatePrompt(prompt.id, { text: event.target.value })
                    }
                    rows={2}
                    className="w-full resize-y rounded-lg border border-border bg-paper px-3 py-2 font-mono text-xs leading-5 text-ink outline-none focus:border-ink disabled:bg-transparent disabled:opacity-80"
                  />
                  <p className="mt-1 text-xs text-ink-muted">
                    {prompt.whySelected}
                  </p>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                    {prompt.included ? "Included" : "Discarded"}
                  </span>
                  <span className="mt-1 block font-mono text-xs text-ink-muted">
                    × {prompt.plannedSamples}
                  </span>
                </div>
              </article>
            ))}
        </div>
      </section>
    </div>
  );
}

function EvidencePanel({
  report,
  project,
  isQueueing,
  onQueue,
}: {
  report: VisibilityWorkspaceReport;
  project: VisibilityProject;
  isQueueing: boolean;
  onQueue: () => void;
}) {
  const canRun =
    project.state === "ready_to_benchmark" &&
    project.storageStatus === "stored";
  const runCta = benchmarkCta(project, canRun);
  if (!report.evidenceRows.length)
    return (
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-dashed border-border-strong bg-paper-muted p-6 sm:p-8">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-score-high">
            <PulseIcon />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
            Evidence explorer
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
            No answer evidence yet.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-ink-muted">
            Once the cohort is approved, every result lands here with its answer
            excerpt, provider policy, citations, verification state, and parser
            decision. Empty does not mean zero visibility.
          </p>
          <button
            type="button"
            disabled={!canRun || isQueueing}
            onClick={onQueue}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isQueueing ? "Queueing…" : runCta}
            <ArrowIcon />
          </button>
        </article>
        <article className="rounded-2xl border border-border bg-paper p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
            Run contract
          </p>
          <dl className="mt-5 space-y-4">
            <Definition
              label="Surface"
              value="OpenAI web search · controlled run"
            />
            <Definition
              label="Policy"
              value={`Search required · ${project.intake.runtimePolicy.repeatRuns} repeat${project.intake.runtimePolicy.repeatRuns === 1 ? "" : "s"}`}
            />
            <Definition
              label="Evidence gate"
              value="Answer + source resolution + semantic claim review + repeat threshold"
            />
          </dl>
        </article>
      </div>
    );
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
            Evidence explorer
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
            The answer is the unit of analysis.
          </h2>
        </div>
        <span className="rounded-lg bg-paper-muted px-3 py-2 font-mono text-xs text-ink-muted">
          {report.evidenceRows.length} retained runs
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {report.evidenceRows.map((row) => (
          <article
            key={row.runId}
            className="rounded-xl border border-border bg-paper p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusTag
                    tone={row.status === "measured" ? "positive" : "warning"}
                  >
                    {row.status}
                  </StatusTag>
                  <StatusTag
                    tone={
                      row.confidence === "high"
                        ? "positive"
                        : row.confidence === "medium"
                          ? "neutral"
                          : "warning"
                    }
                  >
                    {row.confidence} repeat confidence
                  </StatusTag>
                  <StatusTag tone={row.brandMentioned ? "positive" : "neutral"}>
                    {row.brandMentioned
                      ? "entity mentioned"
                      : "entity not mentioned"}
                  </StatusTag>
                </div>
                <h3 className="mt-3 font-mono text-sm font-semibold leading-6 text-ink">
                  {row.prompt}
                </h3>
                <p className="mt-1 text-xs text-ink-muted">
                  {row.market} · {row.modelRuntime} ·{" "}
                  {new Date(row.runAt).toLocaleString()}
                </p>
              </div>
              <span className="font-mono text-xs text-ink-muted">
                {row.citations.length} citations
              </span>
            </div>
            <p className="mt-4 rounded-lg bg-paper-muted px-3.5 py-3 text-sm leading-6 text-ink-muted">
              {row.answerExcerpt ??
                "Raw answer retained in the private artifact store."}
            </p>
            {row.citations.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {row.citations.map((citation) => {
                  const verification =
                    citation.verificationStatus ??
                    (citation.resolved ? "citation_resolved" : "unresolved");
                  return (
                    <a
                      key={`${row.runId}-${citation.url}`}
                      href={citation.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold text-ink transition hover:border-ink"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${verification === "claim_supported" ? "bg-emerald-500" : verification === "citation_resolved" ? "bg-sky-500" : "bg-amber-500"}`}
                      />
                      <span className="max-w-48 truncate">
                        {sourceLabel(citation.url)}
                      </span>
                      <span className="text-ink-muted">
                        {verification.replace("_", " ")}
                      </span>
                    </a>
                  );
                })}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function SourcesPanel({ report }: { report: VisibilityWorkspaceReport }) {
  if (!report.sourceRows.length)
    return (
      <EmptyPanel
        eyebrow="Citation source map"
        title="Sources appear after an answer cites them."
        body="AnswerLint only turns a source into a decision input after the URL resolves independently. Provider citations and source verification remain inspectable."
      />
    );
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
            Citation source map
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
            What the answers are actually using.
          </h2>
        </div>
        <span className="font-mono text-xs text-ink-muted">
          {report.sourceRows.length} unique sources
        </span>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border bg-paper-muted px-4 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-ink-muted">
          <span>Source</span>
          <span>Citations</span>
          <span>Verification</span>
        </div>
        {report.sourceRows.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border bg-paper px-4 py-4 last:border-0 hover:bg-paper-muted"
          >
            <span>
              <span className="block text-sm font-semibold text-ink">
                {source.domain}
              </span>
              <span className="mt-1 block max-w-lg truncate text-xs text-ink-muted">
                {source.url}
              </span>
            </span>
            <span className="font-mono text-sm text-ink">
              {source.citationCount}
            </span>
            <span className="text-right">
              <StatusTag tone={source.resolvedCount ? "positive" : "warning"}>
                {source.resolvedCount}/{source.citationCount} resolved
              </StatusTag>
              <span className="mt-1 block text-[10px] uppercase tracking-wide text-ink-muted">
                {source.sourceType}
              </span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

function ActionsPanel({ report }: { report: VisibilityWorkspaceReport }) {
  if (!report.actions.length)
    return (
      <EmptyPanel
        eyebrow="Action queue"
        title="No action is promoted from a weak signal."
        body={report.actionQueueMessage}
      />
    );
  return (
    <div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
          Action queue
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
          Evidence-backed work, ready for an owner.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          Each action names the decision owner, target page, completion
          criteria, and the locked prompt used to verify impact.
        </p>
      </div>
      <div className="mt-5 grid gap-3">
        {report.actions.map((action) => {
          const crewAction = report.crewAnalysis?.actions.find(
            (item) => item.title === action.action,
          );
          return (
            <article
              key={action.id}
              className="rounded-xl border border-border bg-paper p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <StatusTag
                      tone={
                        action.confidence === "insufficient"
                          ? "warning"
                          : "positive"
                      }
                    >
                      {action.confidence} confidence
                    </StatusTag>
                    <span className="self-center text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                      {crewAction ? `${crewAction.stakes} stakes · ` : ""}
                      {action.owner.replace("_", " ")} · {action.effort} effort
                      {crewAction ? ` · ${crewAction.impactHorizon.replace("_", " ")}` : ""}
                    </span>
                  </div>
                  <h3 className="mt-3 max-w-3xl text-base font-semibold leading-6 text-ink">
                    {action.action}
                  </h3>
                </div>
                <span className="font-mono text-xs text-ink-muted">
                  {crewAction?.businessOutcome.replace("_", " ") ??
                    action.expectedImpact.replace("_", " ")}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink-muted">
                {action.whyNow}
              </p>
              {crewAction ? (
                <div className="mt-4 grid gap-3 rounded-xl border border-border bg-paper-muted p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                      Value hypothesis · {crewAction.decisionMakers.join(" / ")}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-ink">
                      {crewAction.valueHypothesis}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                      Cost of inaction
                    </p>
                    <p className="mt-1 text-xs leading-5 text-ink">
                      {crewAction.costOfInaction}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                      Target page
                    </p>
                    <a
                      href={crewAction.linkedPageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block break-all text-xs font-semibold text-ink underline underline-offset-4"
                    >
                      {crewAction.linkedPageUrl}
                    </a>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                      Done when
                    </p>
                    <ul className="mt-1 space-y-1 text-xs leading-5 text-ink">
                      {crewAction.acceptanceCriteria.map((criterion) => (
                        <li key={criterion}>• {criterion}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
              {crewAction?.sourceUrls.length ? (
                <div className="mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                    Why this action · cited evidence
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {crewAction.sourceUrls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink underline underline-offset-4"
                      >
                        {sourceLabel(url)}
                      </a>
                    ))}
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-ink-muted">
                    Runs: {crewAction.evidenceRunIds.join(", ")}
                  </p>
                </div>
              ) : null}
              {crewAction ? (
                <details className="mt-4 rounded-xl border border-border bg-paper px-4 py-3">
                  <summary className="cursor-pointer text-xs font-bold text-ink">
                    First-principles evidence thesis
                  </summary>
                  <div className="mt-3 space-y-3 text-xs leading-5 text-ink-muted">
                    <p><span className="font-bold text-ink">Thesis: </span>{crewAction.evidenceThesis}</p>
                    <div>
                      <p className="font-bold text-ink">Alternative explanations considered</p>
                      <ul className="mt-1 space-y-1">{crewAction.alternativesConsidered.map((item) => <li key={item}>• {item}</li>)}</ul>
                    </div>
                    <div>
                      <p className="font-bold text-ink">Do not do</p>
                      <ul className="mt-1 space-y-1">{crewAction.doNotDo.map((item) => <li key={item}>• {item}</li>)}</ul>
                    </div>
                    <p><span className="font-bold text-ink">Falsify this thesis when: </span>{crewAction.falsificationRule}</p>
                  </div>
                </details>
              ) : null}
              <div className="mt-4 rounded-lg bg-paper-muted px-3 py-2.5 text-xs leading-5 text-ink">
                <span className="font-bold">Re-test rule: </span>
                {action.verificationRule}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function SettingsPanel({
  project,
  report,
}: {
  project: VisibilityProject;
  report: VisibilityWorkspaceReport;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-2xl border border-border bg-paper p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
          Controlled-run method
        </p>
        <dl className="mt-5 space-y-4">
          <Definition
            label="Measurement lane"
            value="Controlled provider API run"
          />
          <Definition
            label="Search policy"
            value={
              project.intake.runtimePolicy.searchMode === "search_enabled"
                ? "Search required"
                : "Model only"
            }
          />
          <Definition
            label="Repeat policy"
            value={`${project.intake.runtimePolicy.repeatRuns} fresh run${project.intake.runtimePolicy.repeatRuns === 1 ? "" : "s"} per prompt`}
          />
          <Definition
            label="Benchmark cap"
            value={`${MAX_VISIBILITY_RUNS_PER_BENCHMARK} provider calls per run`}
          />
        </dl>
      </article>
      <article className="rounded-2xl border border-border bg-paper-muted p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
          Evidence safeguards
        </p>
        <ul className="mt-5 space-y-3 text-sm leading-6 text-ink-muted">
          <li className="flex gap-3">
            <CheckIcon />
            Only the supported controlled surface can be selected in this beta.
          </li>
          <li className="flex gap-3">
            <CheckIcon />A resolved source URL is distinct from semantic claim
            support.
          </li>
          <li className="flex gap-3">
            <CheckIcon />
            The raw answer and complete provider-source manifest are retained as
            private artifacts.
          </li>
          <li className="flex gap-3">
            <CheckIcon />
            {report.measurementCoverage.completedRuns
              ? "Reported metrics exclude incomplete groups."
              : "Metrics remain blank until the repeat requirement is met."}
          </li>
        </ul>
      </article>
    </div>
  );
}

function RunProgress({
  progress,
}: {
  progress: NonNullable<VisibilityProject["benchmarkProgress"]>;
}) {
  const processed = progress.completedRuns + progress.failedRuns;
  const percentage = progress.plannedRuns
    ? Math.round((processed / progress.plannedRuns) * 100)
    : 0;
  return (
    <section
      aria-live="polite"
      className="mt-5 rounded-2xl border border-border bg-paper p-4 shadow-soft sm:p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
            Live benchmark · {benchmarkStageLabel(progress.currentStage)}
          </p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {progress.message}
          </p>
        </div>
        <span className="font-mono text-sm font-semibold text-ink">
          {processed}/{progress.plannedRuns}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${progress.currentStage === "failed" ? "bg-rose-500" : "bg-emerald-500"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {progress.failedRuns ? (
        <p className="mt-2 text-xs text-rose-700">
          {progress.failedRuns} provider run
          {progress.failedRuns === 1 ? "" : "s"} failed; completed evidence
          remains preserved.
        </p>
      ) : null}
    </section>
  );
}

function benchmarkStageLabel(
  stage: NonNullable<VisibilityProject["benchmarkProgress"]>["currentStage"],
) {
  return {
    idle: "Preparing",
    queued: "Waiting for worker",
    collecting: "Collecting answers",
    verifying: "Verifying cited sources",
    interpreting: "Building decision brief",
    complete: "Evidence ready",
    failed: "Needs attention",
  }[stage];
}

function EmptyPanel({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-dashed border-border-strong bg-paper-muted p-7 sm:p-10">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-score-high">
        <PulseIcon />
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted">{body}</p>
    </article>
  );
}
function Lane({
  name,
  state,
  body,
}: {
  name: string;
  state: string;
  body: React.ReactNode;
}) {
  return (
    <div className="border-b border-border pb-3 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{name}</p>
        <span className="rounded-full border border-border-strong px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
          {state}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-ink-muted">{body}</p>
    </div>
  );
}
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block text-sm font-semibold text-ink">
      <p>{label}</p>
      {hint ? (
        <p className="mt-1 text-xs font-normal leading-5 text-ink-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs font-semibold text-rose-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}
function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.13em] text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1.5 break-words text-sm leading-6 text-ink">{value}</dd>
    </div>
  );
}
function ApprovalBadge({ approved }: { approved: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${approved ? "bg-emerald-100 text-emerald-800" : "bg-paper-muted text-ink-muted"}`}
    >
      {approved ? "Approved" : "Review"}
    </span>
  );
}
function StatusPill({ state }: { state: VisibilityProject["state"] }) {
  return (
    <span className="rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-white/70">
      {state.replaceAll("_", " ")}
    </span>
  );
}
function StatusTag({
  tone,
  children,
}: {
  tone: "positive" | "neutral" | "warning";
  children: React.ReactNode;
}) {
  const classes =
    tone === "positive"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-border bg-paper-muted text-ink-muted";
  return (
    <span
      className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${classes}`}
    >
      {children}
    </span>
  );
}
function Feedback({
  tone,
  message,
}: {
  tone: "error" | "notice";
  message: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mt-5 rounded-xl border px-4 py-3 text-sm ${tone === "error" ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}
    >
      {message}
    </div>
  );
}
function benchmarkCta(project: VisibilityProject, canRun: boolean) {
  if (canRun) return "Run the report";
  if (project.state === "awaiting_brand_approval") return "Approve the brand first";
  if (project.state === "awaiting_topic_approval") return "Approve the questions first";
  if (project.state === "benchmark_queued") return "Report queued";
  if (project.state === "benchmarking") return "Report running";
  if (project.state === "completed") return "Report ready";
  if (project.state === "failed") return "Review the failed run";
  return project.storageStatus !== "stored"
    ? "Connect storage to run"
    : "Finish approval first";
}
function sourceLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-4 w-4 fill-none stroke-current stroke-2"
    >
      <path d="M2 8h11M9 4l4 4-4 4" />
    </svg>
  );
}
function PulseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-4 w-4 fill-none stroke-current stroke-2"
    >
      <path d="M1 8h3l1.5-4 3 8 1.5-4H15" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="mt-1 h-3.5 w-3.5 shrink-0 fill-none stroke-current stroke-2 text-emerald-700"
    >
      <path d="m3 8 3 3 7-7" />
    </svg>
  );
}
