"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

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
type WorkspaceView = "overview" | "portfolio" | "evidence" | "sources" | "actions" | "settings";

const TOKEN_STORAGE_PREFIX = "answerlint-visibility-token:";
const inputClass = "mt-2 w-full rounded-xl border border-border bg-paper px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-ink-subtle focus:border-ink focus:ring-4 focus:ring-ink/5";
const cardClass = "rounded-2xl border border-border bg-card shadow-soft";
const surfaceById = new Map(VISIBILITY_SURFACE_DEFINITIONS.map((surface) => [surface.surface, surface]));

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

function storeToken(projectId: string, token: string | undefined) {
  if (typeof window === "undefined" || !token) return;
  window.localStorage.setItem(tokenStorageKey(projectId), token);
}

export function VisibilityWorkspaceClient({ initialProjectId }: Props) {
  const [project, setProject] = useState<VisibilityProject | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadedReport, setLoadedReport] = useState<VisibilityWorkspaceReport | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>("overview");
  const [useCasesText, setUseCasesText] = useState("");
  const [isSubmitting, startSubmit] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [isQueueing, startQueue] = useTransition();
  const form = useForm<VisibilityIntake>({
    resolver: zodResolver(visibilityIntakeSchema),
    defaultValues: defaultValues(),
  });
  const competitors = useFieldArray({ control: form.control, name: "competitors" });
  const markets = form.watch("markets");
  const surfaces = form.watch("surfaces");
  const repeats = form.watch("runtimePolicy.repeatRuns");
  const plannedDraftRuns = Math.max(1, 8 * surfaces.length * repeats);
  const plannedReport = useMemo(
    () => (project ? buildVisibilityWorkspaceReport(project) : null),
    [project],
  );
  const workspaceReport = loadedReport ?? plannedReport;

  const loadReport = useCallback(async (projectId: string, token: string) => {
    try {
      const response = await fetch(`/api/visibility/projects/${projectId}/report`, {
        headers: { [VISIBILITY_PROJECT_TOKEN_HEADER]: token },
      });
      const payload = (await response.json()) as { report?: VisibilityWorkspaceReport };
      if (response.ok && payload.report) setLoadedReport(payload.report);
    } catch {
      // The local plan remains useful until durable evidence is available.
    }
  }, []);

  const loadProject = useCallback(async (projectId: string, token: string) => {
    try {
      const response = await fetch(`/api/visibility/projects/${projectId}`, {
        headers: { [VISIBILITY_PROJECT_TOKEN_HEADER]: token },
      });
      const payload = (await response.json()) as { project?: VisibilityProject; error?: string };
      if (!response.ok || !payload.project) throw new Error(payload.error ?? "Project could not be loaded.");
      setProject({ ...payload.project, editToken: token });
      void loadReport(projectId, token);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Project could not be loaded.");
    }
  }, [loadReport]);

  useEffect(() => {
    if (!initialProjectId) return;
    const token = readToken(initialProjectId);
    if (!token) {
      setError("This workspace needs its browser ownership token. Create it in this browser, or sign in once accounts are enabled.");
      return;
    }
    void loadProject(initialProjectId, token);
  }, [initialProjectId, loadProject]);

  useEffect(() => {
    if (!project?.editToken || !["benchmark_queued", "benchmarking"].includes(project.state)) return;
    const timer = window.setInterval(() => void loadProject(project.id, project.editToken as string), 8_000);
    return () => window.clearInterval(timer);
  }, [loadProject, project?.editToken, project?.id, project?.state]);

  function updateUseCases(value: string) {
    setUseCasesText(value);
    form.setValue(
      "keyUseCases",
      value.split("\n").map((item) => item.trim()).filter(Boolean),
      { shouldValidate: true },
    );
  }

  function toggleMarket(market: string) {
    const next = markets.includes(market) ? markets.filter((item) => item !== market) : [...markets, market];
    form.setValue("markets", next.length ? next : [market], { shouldValidate: true });
  }

  function toggleSurface(surface: VisibilitySurface) {
    const definition = surfaceById.get(surface);
    if (!definition || definition.availability !== "available") return;
    const next = surfaces.includes(surface) ? surfaces.filter((item) => item !== surface) : [...surfaces, surface];
    form.setValue("surfaces", next.length ? next : [surface], { shouldValidate: true });
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
        const payload = (await response.json()) as { project?: VisibilityProject; error?: string };
        if (!response.ok || !payload.project) throw new Error(payload.error ?? "Workspace could not be created.");
        setProject(payload.project);
        setLoadedReport(null);
        setActiveView("overview");
        storeToken(payload.project.id, payload.project.editToken);
        if (payload.project.storageStatus === "stored") {
          window.history.replaceState(null, "", `/tools/ai-visibility?projectId=${payload.project.id}`);
        }
        setNotice(payload.project.storageStatus === "stored"
          ? "Workspace created. Confirm your entity baseline before any provider calls are made."
          : "Workspace created for this browser session. Connect Supabase to retain durable evidence across devices.");
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Workspace could not be created.");
      }
    });
  }

  function persistApproval(next: VisibilityProject, approval: unknown, successMessage: string) {
    setError("");
    setNotice("");
    startSave(async () => {
      try {
        if (next.storageStatus !== "stored" || !next.editToken) {
          setProject(next);
          setLoadedReport(null);
          setNotice(`${successMessage} Connect Supabase before using a durable benchmark.`);
          return;
        }
        const response = await fetch(`/api/visibility/projects/${next.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", [VISIBILITY_PROJECT_TOKEN_HEADER]: next.editToken },
          body: JSON.stringify(approval),
        });
        const payload = (await response.json()) as { project?: VisibilityProject; error?: string };
        if (!response.ok || !payload.project) throw new Error(payload.error ?? "Approval could not be saved.");
        setProject({ ...payload.project, editToken: next.editToken });
        setLoadedReport(null);
        setNotice(successMessage);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Approval could not be saved.");
      }
    });
  }

  function approveBrandCard() {
    if (!project) return;
    persistApproval(applyProjectApprovals(project, { brandCard: true }), { brandCard: true }, "Entity baseline approved. Review the benchmark cohort next.");
  }

  function approveTopics() {
    if (!project) return;
    const topicIds = project.topics.filter((topic) => topic.included).map((topic) => topic.id);
    if (!topicIds.length) {
      setError("Keep at least one topic in the benchmark cohort.");
      return;
    }
    persistApproval(applyProjectApprovals(project, { topicIds }), { topicIds }, "Benchmark cohort locked. It is ready for a controlled run.");
  }

  function toggleTopic(topicId: string) {
    setProject((current) => current ? {
      ...current,
      topics: current.topics.map((topic) => topic.id === topicId ? { ...topic, included: !topic.included } : topic),
    } : current);
  }

  function queueBenchmark() {
    if (!project) return;
    if (project.storageStatus !== "stored" || !project.editToken) {
      setError("Connect Supabase storage before running a durable benchmark.");
      return;
    }
    setError("");
    setNotice("");
    startQueue(async () => {
      try {
        const response = await fetch(`/api/visibility/projects/${project.id}/benchmark`, {
          method: "POST",
          headers: { [VISIBILITY_PROJECT_TOKEN_HEADER]: project.editToken as string },
        });
        const payload = (await response.json()) as { project?: VisibilityProject; error?: string };
        if (!response.ok || !payload.project) throw new Error(payload.error ?? "Benchmark could not be queued.");
        setProject({ ...payload.project, editToken: project.editToken });
        setLoadedReport(null);
        setNotice("Controlled benchmark queued. The workspace will refresh as answer and source evidence arrives.");
      } catch (queueError) {
        setError(queueError instanceof Error ? queueError.message : "Benchmark could not be queued.");
      }
    });
  }

  return (
    <main id="main-content" className="safe-pad mx-auto max-w-content py-7 sm:px-6 lg:px-8 lg:py-10">
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
          onQueue={queueBenchmark}
          onReset={() => { setProject(null); setLoadedReport(null); setActiveView("overview"); }}
        />
      ) : null}
      {error ? <Feedback tone="error" message={error} /> : null}
      {notice ? <Feedback tone="notice" message={notice} /> : null}
    </main>
  );
}

function SetupScreen({
  form, competitors, useCasesText, surfaces, markets, repeats, plannedDraftRuns, isSubmitting,
  onSubmit, onUseCasesChange, onToggleMarket, onToggleSurface,
}: {
  form: ReturnType<typeof useForm<VisibilityIntake>>;
  competitors: ReturnType<typeof useFieldArray<VisibilityIntake, "competitors">>;
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
  return <>
    <section className="overflow-hidden rounded-[1.5rem] border border-ink bg-ink px-5 py-8 text-paper shadow-[0_26px_70px_rgba(10,10,10,0.22)] sm:px-8 lg:px-10 lg:py-11">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-score-high">
            <PulseIcon /> AI Visibility (beta)
          </div>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl">Know which buyer answers you can actually influence.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">Build a compact, approval-first benchmark. AnswerLint records the prompt, run policy, answer, citations, source checks, and the scoped evidence your team can review.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <HeroStat label="No vanity rank" value="Evidence" body="Every score opens to the underlying answer." />
          <HeroStat label="Measurement lane" value="Controlled" body="Provider API tests are clearly labelled." />
          <HeroStat label="Run budget" value="≤ 28" body="A firm cap keeps experiments intentional." />
        </div>
      </div>
    </section>

    <section className={`${cardClass} mt-6 overflow-hidden`}>
      <div className="border-b border-border bg-paper-muted px-5 py-5 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">Create a controlled workspace</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">Define the entity before measuring it.</h2></div>
          <div className="rounded-xl border border-border bg-paper px-4 py-3 text-right"><p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Draft scope</p><p className="mt-1 font-mono text-lg font-semibold text-ink">{plannedDraftRuns} runs</p><p className="mt-0.5 text-xs text-ink-muted">8 core prompts × {surfaces.length} surface × {repeats} repeats</p></div>
        </div>
      </div>
      <form className="p-5 sm:p-8" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-x-5 gap-y-6 lg:grid-cols-2">
          <Field label="Brand URL" error={form.formState.errors.brandUrl?.message}><input aria-label="Brand URL" className={inputClass} placeholder="https://example.com" autoComplete="url" {...form.register("brandUrl")} /></Field>
          <Field label="Brand name" error={form.formState.errors.brandName?.message}><input aria-label="Brand name" className={inputClass} placeholder="AnswerLint" autoComplete="organization" {...form.register("brandName")} /></Field>
          <Field label="Category or product" error={form.formState.errors.primaryCategory?.message}><input aria-label="Category or product" className={inputClass} placeholder="Compliance automation software" {...form.register("primaryCategory")} /></Field>
          <Field label="Primary customer" error={form.formState.errors.targetCustomers?.message}><input aria-label="Primary customer" className={inputClass} placeholder="Mid-market SaaS security teams" {...form.register("targetCustomers")} /></Field>
          <div className="lg:col-span-2"><Field label="Buyer jobs to test" hint="One high-value use case per line. These become the first prompt cohort." error={form.formState.errors.keyUseCases?.message as string | undefined}><textarea aria-label="Buyer jobs to test" className={inputClass} rows={3} value={useCasesText} onChange={(event) => onUseCasesChange(event.target.value)} placeholder={"prepare for SOC 2\ncompare compliance automation tools"} /></Field></div>
          <div className="lg:col-span-2"><Field label="Measurement surface" hint="This closed beta measures one clearly labelled controlled surface; unconfigured products are not presented as data."><div className="mt-2 grid gap-3 md:grid-cols-2">{VISIBILITY_SURFACE_DEFINITIONS.map((surface) => { const selected = surfaces.includes(surface.surface); return <button key={surface.surface} type="button" onClick={() => onToggleSurface(surface.surface)} className={`group relative min-h-28 rounded-xl border p-4 text-left transition ${selected ? "border-ink bg-ink text-white" : "border-border bg-paper hover:border-ink"}`} aria-pressed={selected}><div className="flex items-start justify-between gap-3"><span className="font-semibold">{surface.label}</span><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${selected ? "border-white/20 text-score-high" : "border-border-strong text-ink-muted"}`}>Controlled beta</span></div><p className={`mt-2 text-xs leading-5 ${selected ? "text-white/65" : "text-ink-muted"}`}>{surface.description}</p></button>; })}</div></Field></div>
          <div><p className="text-sm font-semibold text-ink">Markets</p><div className="mt-2 flex flex-wrap gap-2">{["US", "GB", "SG", "AU", "DE"].map((market) => <button key={market} type="button" onClick={() => onToggleMarket(market)} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${markets.includes(market) ? "border-ink bg-ink text-white" : "border-border bg-paper text-ink-muted hover:border-ink"}`} aria-pressed={markets.includes(market)}>{market}</button>)}</div></div>
          <Field label="Run policy" hint="Repeated fresh API runs show stability. Scheduling is intentionally configured after the first benchmark."><div className="mt-2 grid grid-cols-2 gap-3"><label className="rounded-xl border border-border bg-paper p-3 text-xs font-semibold text-ink">Samples<select className="mt-2 w-full bg-transparent text-sm font-semibold outline-none" {...form.register("runtimePolicy.repeatRuns", { valueAsNumber: true })}><option value={1}>1 exploratory</option><option value={3}>3 evidence-grade</option><option value={5}>5 high variance</option></select></label><div className="rounded-xl border border-border bg-paper p-3 text-xs font-semibold text-ink">Search<p className="mt-2 text-sm font-semibold">Required for this controlled run</p></div></div></Field>
          <div className="lg:col-span-2 rounded-xl border border-border bg-paper-muted p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-ink">Confirmed competitors <span className="font-normal text-ink-muted">(optional)</span></p><p className="mt-1 text-xs leading-5 text-ink-muted">Comparisons use only entities you confirm; no algorithmic rival is silently added.</p></div><button type="button" onClick={() => competitors.append({ name: "", url: "" })} className="rounded-lg border border-border-strong bg-paper px-3 py-2 text-xs font-bold text-ink hover:border-ink">+ Add competitor</button></div>{competitors.fields.length ? <div className="mt-4 space-y-3">{competitors.fields.map((field, index) => <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input aria-label={`Competitor ${index + 1} name`} className="rounded-lg border border-border bg-paper px-3 py-2.5 text-sm outline-none focus:border-ink" placeholder="Competitor name" {...form.register(`competitors.${index}.name`)} /><input aria-label={`Competitor ${index + 1} URL`} className="rounded-lg border border-border bg-paper px-3 py-2.5 text-sm outline-none focus:border-ink" placeholder="https://competitor.com" {...form.register(`competitors.${index}.url`)} /><button type="button" className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-ink-muted hover:border-ink hover:text-ink" onClick={() => competitors.remove(index)}>Remove</button></div>)}</div> : null}</div>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5"><p className="max-w-xl text-sm leading-6 text-ink-muted">You review the entity and prompt cohort before AnswerLint makes a durable provider call. The baseline uses {DEFAULT_VISIBILITY_BASELINE_RUNS} runs and can grow only to {MAX_VISIBILITY_RUNS_PER_BENCHMARK} approved runs.</p><button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink-muted disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Creating workspace…" : "Create evidence workspace"}<ArrowIcon /></button></div>
      </form>
    </section>
  </>;
}

function Workspace({ project, report, activeView, isSaving, isQueueing, onViewChange, onApproveBrand, onApproveTopics, onToggleTopic, onQueue, onReset }: {
  project: VisibilityProject; report: VisibilityWorkspaceReport; activeView: WorkspaceView; isSaving: boolean; isQueueing: boolean;
  onViewChange: (view: WorkspaceView) => void; onApproveBrand: () => void; onApproveTopics: () => void; onToggleTopic: (id: string) => void; onQueue: () => void; onReset: () => void;
}) {
  const canRun = project.state === "ready_to_benchmark" && project.storageStatus === "stored";
  const runCta = benchmarkCta(project, canRun);
  return <>
    <section className="overflow-hidden rounded-[1.5rem] border border-ink bg-ink text-white shadow-[0_24px_65px_rgba(10,10,10,0.18)]"><div className="border-b border-white/10 px-5 py-3 text-xs text-white/55 sm:px-7"><span className="font-mono text-score-high">CONTROLLED RUN</span><span className="mx-2 text-white/20">/</span>OpenAI web-search evidence is labelled as a reproducible API run, not a consumer search rank.</div><div className="flex flex-col gap-5 px-5 py-6 sm:px-7 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex flex-wrap items-center gap-3"><p className="font-mono text-xs uppercase tracking-[0.16em] text-score-high">{project.intake.primaryCategory}</p><StatusPill state={project.state} /></div><h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{project.intake.brandName} <span className="text-white/45">Evidence Loop</span></h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{report.executiveBrief}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={onReset} className="rounded-lg border border-white/20 px-3.5 py-2.5 text-xs font-bold text-white/80 hover:bg-white/10">New workspace</button><button type="button" onClick={onQueue} disabled={!canRun || isQueueing} className="inline-flex items-center gap-2 rounded-lg bg-score-high px-4 py-2.5 text-xs font-bold text-ink transition hover:bg-[#d9ff45] disabled:cursor-not-allowed disabled:opacity-50">{isQueueing ? "Queueing run…" : runCta}<ArrowIcon /></button></div></div></section>
    <section className={`${cardClass} mt-5 overflow-hidden`}><WorkspaceNav activeView={activeView} onViewChange={onViewChange} report={report} />
      <div className="p-5 sm:p-7">{activeView === "overview" ? <OverviewPanel project={project} report={report} onViewChange={onViewChange} /> : null}{activeView === "portfolio" ? <PortfolioPanel project={project} report={report} isSaving={isSaving} onApproveBrand={onApproveBrand} onApproveTopics={onApproveTopics} onToggleTopic={onToggleTopic} /> : null}{activeView === "evidence" ? <EvidencePanel report={report} project={project} isQueueing={isQueueing} onQueue={onQueue} /> : null}{activeView === "sources" ? <SourcesPanel report={report} /> : null}{activeView === "actions" ? <ActionsPanel report={report} /> : null}{activeView === "settings" ? <SettingsPanel project={project} report={report} /> : null}</div>
    </section>
  </>;
}

function WorkspaceNav({ activeView, onViewChange, report }: { activeView: WorkspaceView; onViewChange: (view: WorkspaceView) => void; report: VisibilityWorkspaceReport }) {
  const tabs: Array<{ id: WorkspaceView; label: string; count?: number }> = [{ id: "overview", label: "Overview" }, { id: "portfolio", label: "Portfolio" }, { id: "evidence", label: "Evidence", count: report.measurementCoverage.completedRuns }, { id: "sources", label: "Sources", count: report.sourceRows.length }, { id: "actions", label: "Actions", count: report.actions.length }, { id: "settings", label: "Method" }];
  return <nav className="flex overflow-x-auto border-b border-border px-3 pt-3 sm:px-5" aria-label="Workspace views">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => onViewChange(tab.id)} className={`relative shrink-0 px-3 py-3 text-sm font-semibold transition ${activeView === tab.id ? "text-ink" : "text-ink-muted hover:text-ink"}`}><span className="inline-flex items-center gap-2">{tab.label}{tab.count !== undefined ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono ${activeView === tab.id ? "bg-ink text-white" : "bg-paper-muted text-ink-muted"}`}>{tab.count}</span> : null}</span>{activeView === tab.id ? <span className="absolute inset-x-3 bottom-0 h-0.5 bg-ink" /> : null}</button>)}</nav>;
}

function OverviewPanel({ project, report, onViewChange }: { project: VisibilityProject; report: VisibilityWorkspaceReport; onViewChange: (view: WorkspaceView) => void }) {
  const metrics = report.metrics;
  return <div className="space-y-7"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><MetricCard label="Measurement coverage" value={report.measurementCoverage.percentage === null ? "—" : `${report.measurementCoverage.percentage}%`} detail={`${report.measurementCoverage.completedRuns} completed / ${report.measurementCoverage.plannedRuns} planned`} tone="dark" />{metrics.map((metric) => <MetricCard key={metric.label} label={metric.label} value={metric.value === null ? "—" : `${metric.value}%`} detail={metric.reason} />)}</div><div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]"><article className="rounded-2xl border border-border bg-paper p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Executive decision</p><h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink">{project.state === "completed" ? "Use the evidence, then ship the smallest credible change." : "Build the measurement instrument before looking for a result."}</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted">{report.actionQueueMessage}</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => onViewChange("evidence")} className="rounded-lg bg-ink px-3.5 py-2.5 text-xs font-bold text-white">Inspect evidence</button><button type="button" onClick={() => onViewChange("portfolio")} className="rounded-lg border border-border-strong px-3.5 py-2.5 text-xs font-bold text-ink">Review cohort</button></div></article><article className="rounded-2xl border border-border bg-paper-muted p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Measurement lanes</p><div className="mt-4 space-y-3"><Lane name="Controlled run" state="Active" body="Locked prompt + provider policy + retained source evidence." /><Lane name="Native Google" state="Planned" body="Search Console data stays separate when connected." /><Lane name="Site readiness" state="Available" body={<><Link className="font-semibold text-ink underline underline-offset-4" href="/tools/business-aware-scan">Map important pages</Link> before assigning actions.</>} /></div></article></div><section><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Approved opportunity map</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">Where buyer intent meets evidence.</h2></div><button type="button" onClick={() => onViewChange("portfolio")} className="text-xs font-bold text-ink underline underline-offset-4">Open portfolio</button></div><div className="mt-4 grid gap-3 lg:grid-cols-3">{report.topicRows.map((topic) => <article key={topic.topic} className="rounded-xl border border-border bg-paper p-4"><p className="text-xs font-mono uppercase tracking-wide text-ink-muted">{topic.intent}</p><h3 className="mt-2 font-semibold text-ink">{topic.topic}</h3><p className="mt-3 text-xs leading-5 text-ink-muted">{topic.evidence}</p><p className="mt-3 border-t border-border pt-3 text-xs font-semibold leading-5 text-ink">{topic.nextAction}</p></article>)}</div></section></div>;
}

function PortfolioPanel({ project, report, isSaving, onApproveBrand, onApproveTopics, onToggleTopic }: { project: VisibilityProject; report: VisibilityWorkspaceReport; isSaving: boolean; onApproveBrand: () => void; onApproveTopics: () => void; onToggleTopic: (id: string) => void }) {
  const brandApproved = project.brandCard.approvalStatus === "approved";
  return <div className="space-y-6"><div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]"><article className="rounded-2xl border border-border bg-paper p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">1 · Entity baseline</p><h2 className="mt-2 font-display text-xl font-semibold text-ink">{project.brandCard.canonicalName}</h2></div><ApprovalBadge approved={brandApproved} /></div><dl className="mt-5 space-y-3 text-sm"><Definition label="Positioning" value={project.brandCard.valueProposition} /><Definition label="ICP" value={project.brandCard.idealCustomerProfile} /><Definition label="Primary asset" value={project.brandCard.initialOwnedAssets[0]?.url ?? project.intake.brandUrl} /></dl><button type="button" disabled={brandApproved || isSaving} onClick={onApproveBrand} className="mt-5 w-full rounded-lg bg-ink px-3 py-2.5 text-xs font-bold text-white disabled:opacity-45">{brandApproved ? "Baseline approved" : isSaving ? "Saving…" : "Approve entity baseline"}</button></article><article className="rounded-2xl border border-border bg-paper p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">2 · Benchmark cohort</p><h2 className="mt-2 font-display text-xl font-semibold text-ink">Approve the questions that carry commercial weight.</h2></div><div className="rounded-lg bg-paper-muted px-3 py-2 text-right"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Run plan</p><p className="font-mono text-sm font-semibold text-ink">{report.measurementCoverage.plannedRuns} planned</p></div></div><div className="mt-5 space-y-2">{project.topics.map((topic) => <label key={topic.id} className={`grid cursor-pointer grid-cols-[auto_1fr_auto] gap-3 rounded-xl border p-3 transition ${topic.included ? "border-ink bg-ink/[0.025]" : "border-border bg-paper-muted opacity-70"}`}><input type="checkbox" checked={topic.included} onChange={() => onToggleTopic(topic.id)} className="mt-1 h-4 w-4 accent-[var(--color-ink)]" /><span><span className="block text-sm font-semibold text-ink">{topic.statement}</span><span className="mt-1 block text-xs text-ink-muted">{topic.buyerIntent} · {topic.funnelStage} · {topic.commercialValue} value</span></span><span className="font-mono text-xs text-ink-muted">{topic.promptCount} runs</span></label>)}</div><button type="button" disabled={!brandApproved || project.state === "ready_to_benchmark" || isSaving} onClick={onApproveTopics} className="mt-5 w-full rounded-lg bg-ink px-3 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{project.state === "ready_to_benchmark" ? "Cohort locked" : isSaving ? "Saving…" : "Lock approved cohort"}</button>{!brandApproved ? <p className="mt-2 text-xs text-ink-muted">Approve the entity baseline before locking this cohort.</p> : null}</article></div><section><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Prompt portfolio</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">The questions behind every trend line.</h2></div><span className="font-mono text-xs text-ink-muted">v1 · locked on approval</span></div><div className="mt-4 overflow-hidden rounded-xl border border-border"><div className="hidden grid-cols-[1.7fr_0.6fr_0.8fr_0.7fr] gap-4 border-b border-border bg-paper-muted px-4 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-ink-muted sm:grid"><span>Prompt</span><span>Intent</span><span>Surface</span><span>Samples</span></div>{project.prompts.filter((prompt) => project.topics.find((topic) => topic.id === prompt.topicId)?.included).map((prompt) => <article key={prompt.id} className="grid gap-3 border-b border-border bg-paper px-4 py-4 last:border-0 sm:grid-cols-[1.7fr_0.6fr_0.8fr_0.7fr] sm:gap-4"><div><p className="font-mono text-xs leading-5 text-ink">{prompt.text}</p><p className="mt-1 text-xs text-ink-muted">{prompt.whySelected}</p></div><span className="text-xs font-semibold capitalize text-ink">{prompt.buyerRealism.replace("_", " ")}</span><span className="text-xs text-ink-muted">{prompt.surfaces.map((surface) => surfaceById.get(surface)?.shortLabel ?? surface).join(", ")}</span><span className="font-mono text-xs text-ink-muted">× {prompt.plannedSamples}</span></article>)}</div></section></div>;
}

function EvidencePanel({ report, project, isQueueing, onQueue }: { report: VisibilityWorkspaceReport; project: VisibilityProject; isQueueing: boolean; onQueue: () => void }) {
  const canRun = project.state === "ready_to_benchmark" && project.storageStatus === "stored";
  const runCta = benchmarkCta(project, canRun);
  if (!report.evidenceRows.length) return <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><article className="rounded-2xl border border-dashed border-border-strong bg-paper-muted p-6 sm:p-8"><div className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-score-high"><PulseIcon /></div><p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Evidence explorer</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">No answer evidence yet.</h2><p className="mt-3 max-w-xl text-sm leading-7 text-ink-muted">Once the cohort is approved, every result lands here with its answer excerpt, provider policy, citations, verification state, and parser decision. Empty does not mean zero visibility.</p><button type="button" disabled={!canRun || isQueueing} onClick={onQueue} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{isQueueing ? "Queueing…" : runCta}<ArrowIcon /></button></article><article className="rounded-2xl border border-border bg-paper p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Run contract</p><dl className="mt-5 space-y-4"><Definition label="Surface" value="OpenAI web search · controlled run" /><Definition label="Policy" value={`Search required · ${project.intake.runtimePolicy.repeatRuns} repeat${project.intake.runtimePolicy.repeatRuns === 1 ? "" : "s"}`} /><Definition label="Evidence gate" value="Answer + source resolution + semantic claim review + repeat threshold" /></dl></article></div>;
  return <div><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Evidence explorer</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">The answer is the unit of analysis.</h2></div><span className="rounded-lg bg-paper-muted px-3 py-2 font-mono text-xs text-ink-muted">{report.evidenceRows.length} retained runs</span></div><div className="mt-5 space-y-3">{report.evidenceRows.map((row) => <article key={row.runId} className="rounded-xl border border-border bg-paper p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><StatusTag tone={row.status === "measured" ? "positive" : "warning"}>{row.status}</StatusTag><StatusTag tone={row.confidence === "high" ? "positive" : row.confidence === "medium" ? "neutral" : "warning"}>{row.confidence} repeat confidence</StatusTag><StatusTag tone={row.brandMentioned ? "positive" : "neutral"}>{row.brandMentioned ? "entity mentioned" : "entity not mentioned"}</StatusTag></div><h3 className="mt-3 font-mono text-sm font-semibold leading-6 text-ink">{row.prompt}</h3><p className="mt-1 text-xs text-ink-muted">{row.market} · {row.modelRuntime} · {new Date(row.runAt).toLocaleString()}</p></div><span className="font-mono text-xs text-ink-muted">{row.citations.length} citations</span></div><p className="mt-4 rounded-lg bg-paper-muted px-3.5 py-3 text-sm leading-6 text-ink-muted">{row.answerExcerpt ?? "Raw answer retained in the private artifact store."}</p>{row.citations.length ? <div className="mt-4 flex flex-wrap gap-2">{row.citations.map((citation) => { const verification = citation.verificationStatus ?? (citation.resolved ? "citation_resolved" : "unresolved"); return <a key={`${row.runId}-${citation.url}`} href={citation.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold text-ink transition hover:border-ink"><span className={`h-1.5 w-1.5 rounded-full ${verification === "claim_supported" ? "bg-emerald-500" : verification === "citation_resolved" ? "bg-sky-500" : "bg-amber-500"}`} /><span className="max-w-48 truncate">{sourceLabel(citation.url)}</span><span className="text-ink-muted">{verification.replace("_", " ")}</span></a>; })}</div> : null}</article>)}</div></div>;
}

function SourcesPanel({ report }: { report: VisibilityWorkspaceReport }) {
  if (!report.sourceRows.length) return <EmptyPanel eyebrow="Citation source map" title="Sources appear after an answer cites them." body="AnswerLint only turns a source into a decision input after the URL resolves independently. Provider citations and source verification remain inspectable." />;
  return <div><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Citation source map</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">What the answers are actually using.</h2></div><span className="font-mono text-xs text-ink-muted">{report.sourceRows.length} unique sources</span></div><div className="mt-5 overflow-hidden rounded-xl border border-border"><div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border bg-paper-muted px-4 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-ink-muted"><span>Source</span><span>Citations</span><span>Verification</span></div>{report.sourceRows.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border bg-paper px-4 py-4 last:border-0 hover:bg-paper-muted"><span><span className="block text-sm font-semibold text-ink">{source.domain}</span><span className="mt-1 block max-w-lg truncate text-xs text-ink-muted">{source.url}</span></span><span className="font-mono text-sm text-ink">{source.citationCount}</span><span className="text-right"><StatusTag tone={source.resolvedCount ? "positive" : "warning"}>{source.resolvedCount}/{source.citationCount} resolved</StatusTag><span className="mt-1 block text-[10px] uppercase tracking-wide text-ink-muted">{source.sourceType}</span></span></a>)}</div></div>;
}

function ActionsPanel({ report }: { report: VisibilityWorkspaceReport }) {
  if (!report.actions.length) return <EmptyPanel eyebrow="Action queue" title="No action is promoted from a weak signal." body={report.actionQueueMessage} />;
  return <div><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Action queue</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">Evidence-backed work, ready for an owner.</h2></div><div className="mt-5 grid gap-3">{report.actions.map((action) => <article key={action.id} className="rounded-xl border border-border bg-paper p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><StatusTag tone="positive">{action.confidence} confidence</StatusTag><StatusTag tone="neutral">{action.owner.replace("_", " ")}</StatusTag><StatusTag tone="neutral">{action.effort} effort</StatusTag></div><h3 className="mt-3 max-w-3xl text-base font-semibold leading-6 text-ink">{action.action}</h3></div><span className="font-mono text-xs text-ink-muted">{action.expectedImpact.replace("_", " ")}</span></div><p className="mt-3 text-sm leading-6 text-ink-muted">{action.whyNow}</p><div className="mt-4 rounded-lg bg-paper-muted px-3 py-2.5 text-xs leading-5 text-ink"><span className="font-bold">Re-test rule: </span>{action.verificationRule}</div></article>)}</div></div>;
}

function SettingsPanel({ project, report }: { project: VisibilityProject; report: VisibilityWorkspaceReport }) {
  return <div className="grid gap-4 lg:grid-cols-2"><article className="rounded-2xl border border-border bg-paper p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Controlled-run method</p><dl className="mt-5 space-y-4"><Definition label="Measurement lane" value="Controlled provider API run" /><Definition label="Search policy" value={project.intake.runtimePolicy.searchMode === "search_enabled" ? "Search required" : "Model only"} /><Definition label="Repeat policy" value={`${project.intake.runtimePolicy.repeatRuns} fresh run${project.intake.runtimePolicy.repeatRuns === 1 ? "" : "s"} per prompt`} /><Definition label="Benchmark cap" value={`${MAX_VISIBILITY_RUNS_PER_BENCHMARK} provider calls per run`} /></dl></article><article className="rounded-2xl border border-border bg-paper-muted p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Evidence safeguards</p><ul className="mt-5 space-y-3 text-sm leading-6 text-ink-muted"><li className="flex gap-3"><CheckIcon />Only the supported controlled surface can be selected in this beta.</li><li className="flex gap-3"><CheckIcon />A resolved source URL is distinct from semantic claim support.</li><li className="flex gap-3"><CheckIcon />The raw answer and complete provider-source manifest are retained as private artifacts.</li><li className="flex gap-3"><CheckIcon />{report.measurementCoverage.completedRuns ? "Reported metrics exclude incomplete groups." : "Metrics remain blank until the repeat requirement is met."}</li></ul></article></div>;
}

function EmptyPanel({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) { return <article className="rounded-2xl border border-dashed border-border-strong bg-paper-muted p-7 sm:p-10"><div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-score-high"><PulseIcon /></div><p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">{eyebrow}</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">{title}</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted">{body}</p></article>; }
function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "dark" }) { return <article className={`min-h-40 rounded-xl border p-4 ${tone === "dark" ? "border-ink bg-ink text-white" : "border-border bg-paper"}`}><p className={`text-xs font-bold leading-5 ${tone === "dark" ? "text-white/65" : "text-ink-muted"}`}>{label}</p><p className={`mt-4 font-mono text-3xl font-semibold tracking-tight ${tone === "dark" ? "text-score-high" : "text-ink"}`}>{value}</p><p className={`mt-3 text-[11px] leading-5 ${tone === "dark" ? "text-white/60" : "text-ink-muted"}`}>{detail}</p></article>; }
function Lane({ name, state, body }: { name: string; state: string; body: React.ReactNode }) { return <div className="border-b border-border pb-3 last:border-0 last:pb-0"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-ink">{name}</p><span className="rounded-full border border-border-strong px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">{state}</span></div><p className="mt-1.5 text-xs leading-5 text-ink-muted">{body}</p></div>; }
function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) { return <div className="block text-sm font-semibold text-ink"><p>{label}</p>{hint ? <p className="mt-1 text-xs font-normal leading-5 text-ink-muted">{hint}</p> : null}{children}{error ? <span className="mt-1.5 block text-xs font-semibold text-rose-700">{error}</span> : null}</div>; }
function Definition({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-bold uppercase tracking-[0.13em] text-ink-muted">{label}</dt><dd className="mt-1.5 break-words text-sm leading-6 text-ink">{value}</dd></div>; }
function ApprovalBadge({ approved }: { approved: boolean }) { return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${approved ? "bg-emerald-100 text-emerald-800" : "bg-paper-muted text-ink-muted"}`}>{approved ? "Approved" : "Review"}</span>; }
function StatusPill({ state }: { state: VisibilityProject["state"] }) { return <span className="rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-white/70">{state.replaceAll("_", " ")}</span>; }
function StatusTag({ tone, children }: { tone: "positive" | "neutral" | "warning"; children: React.ReactNode }) { const classes = tone === "positive" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-border bg-paper-muted text-ink-muted"; return <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${classes}`}>{children}</span>; }
function Feedback({ tone, message }: { tone: "error" | "notice"; message: string }) { return <div role={tone === "error" ? "alert" : "status"} className={`mt-5 rounded-xl border px-4 py-3 text-sm ${tone === "error" ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{message}</div>; }
function HeroStat({ label, value, body }: { label: string; value: string; body: string }) { return <article className="border border-white/15 bg-white/[0.04] p-3.5"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/45">{label}</p><p className="mt-1 font-mono text-xl font-semibold text-score-high">{value}</p><p className="mt-1 text-xs leading-5 text-white/60">{body}</p></article>; }
function benchmarkCta(project: VisibilityProject, canRun: boolean) { if (canRun) return "Run controlled benchmark"; return project.storageStatus !== "stored" ? "Connect storage to run" : "Complete approval gates"; }
function sourceLabel(url: string) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } }
function ArrowIcon() { return <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="M2 8h11M9 4l4 4-4 4" /></svg>; }
function PulseIcon() { return <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current stroke-2"><path d="M1 8h3l1.5-4 3 8 1.5-4H15" /></svg>; }
function CheckIcon() { return <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-1 h-3.5 w-3.5 shrink-0 fill-none stroke-current stroke-2 text-emerald-700"><path d="m3 8 3 3 7-7" /></svg>; }
