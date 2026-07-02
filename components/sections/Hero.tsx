import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { branding } from "@/config/branding";

export async function Hero() {
  const t = await getTranslations("Hero");
  const developerFixes = [
    t("panelDeveloperFix1"),
    t("panelDeveloperFix2"),
    t("panelDeveloperFix3"),
  ];
  const prompts = [
    {
      query: "best tools for AI visibility audits",
      page: "/compare/ai-visibility",
      status: "Evidence found",
      score: "82",
    },
    {
      query: "AEO checklist for launch pages",
      page: "/docs/aeo-checklist",
      status: "Fix queued",
      score: "64",
    },
    {
      query: "GEO audit in CI pipeline",
      page: "/guides/ci",
      status: "Passing",
      score: "91",
    },
  ];
  const auditSignals = [
    { label: "AEO score", detail: "Answer clarity" },
    { label: "GEO signal", detail: "Trust depth" },
    { label: "Citation fit", detail: "Source quality" },
    { label: "Schema gap", detail: "Markup fixes" },
    { label: "CI gate", detail: "Release floor" },
  ];

  return (
    <section
      id="top"
      className="relative overflow-hidden border-b border-white/10 bg-[#07110f] text-white"
    >
      <div className="enterprise-grid absolute inset-0 opacity-35" />
      <div className="absolute left-1/2 top-[-22rem] h-[46rem] w-[46rem] -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
      <div className="absolute bottom-[-18rem] right-[-16rem] h-[36rem] w-[36rem] rounded-full bg-[#c6ff7c]/10 blur-3xl" />

      <div className="safe-pad relative mx-auto max-w-[80rem] pb-14 pt-8 sm:px-6 sm:pb-20 sm:pt-12 lg:px-8 lg:pb-24 lg:pt-14">
        <div className="mb-8 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.06] p-1.5 shadow-[0_16px_45px_rgba(0,0,0,0.18)] backdrop-blur sm:rounded-full">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex shrink-0 items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-[#07110f]">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Audit signals
            </div>
            {auditSignals.map((signal) => (
              <div
                key={signal.label}
                className="flex shrink-0 items-center gap-3 rounded-full border border-white/10 bg-[#0d1916]/80 px-3.5 py-2 text-sm text-white/78"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-200/70" />
                <span className="font-semibold">{signal.label}</span>
                <span className="hidden text-xs text-white/40 sm:inline">
                  {signal.detail}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr] xl:items-center xl:gap-10">
          <div className="relative">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_18px_rgba(15,139,104,0.95)]" />
              {t("eyebrow")}
            </p>

            <h1 className="font-display text-balance text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
              {t("title")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72 sm:text-xl">
              {t("subtitle")}
            </p>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/58">
              {t("businessLead")}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/playground"
                className="inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#07110f] shadow-[0_18px_44px_rgba(0,0,0,0.22)] transition-colors hover:bg-paper-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
              >
                {t("ctaPlayground")}
              </Link>

              <a
                href={branding.links.github}
                className="inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-fg shadow-[0_18px_44px_rgba(15,139,104,0.18)] transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("ctaGithub")}
              </a>
              <a
                href={branding.links.npm}
                className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white/82 transition-colors hover:border-white/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("ctaNpm")}
              </a>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {(
                [
                  { id: "pill1", label: t("pill1") },
                  { id: "pill2", label: t("pill2") },
                  { id: "pill3", label: t("pill3") },
                ] as const
              ).map(({ id, label }) => (
                <div
                  key={id}
                  className="border border-white/10 bg-white/[0.04] p-3 text-sm font-medium leading-6 text-white/72"
                >
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/34">
                    {id.replace("pill", "Signal 0")}
                  </span>
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-8 overflow-hidden border border-white/10 bg-black/25 shadow-[0_18px_50px_rgba(0,0,0,0.24)] sm:max-w-xl">
              <p className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/42">
                {t("installLabel")}
              </p>
              <code className="block overflow-x-auto px-4 py-4 font-mono text-sm text-emerald-100">
                {branding.installCommand}
              </code>
            </div>
          </div>

          <div className="relative border border-white/10 bg-white/[0.06] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.28)] backdrop-blur">
            <div className="border border-white/10 bg-[#0c1714]">
              <div className="flex flex-col gap-4 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                    {t("panelLabel")}
                  </p>
                  <h2 className="mt-2 font-display text-xl font-semibold text-white sm:text-2xl">
                    {t("panelTitle")}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-100">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  Live audit model
                </div>
              </div>

              <div className="grid gap-px border-b border-white/10 bg-white/10 sm:grid-cols-3">
                {[
                  { label: "Composite", value: "82", delta: "+12 vs floor" },
                  { label: "AEO", value: "88", delta: "answer ready" },
                  { label: "GEO", value: "76", delta: "trust gaps" },
                ].map((score) => (
                  <div
                    key={score.label}
                    className="bg-[#0c1714] p-4 text-left"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">
                      {score.label}
                    </p>
                    <p className="mt-2 font-mono text-4xl font-semibold text-white sm:text-5xl">
                      {score.value}
                    </p>
                    <p className="mt-2 text-xs font-medium text-emerald-100/70">
                      {score.delta}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-px bg-white/10 lg:grid-cols-[0.92fr_1.08fr]">
                <div className="bg-[#0c1714] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/38">
                    {t("panelBusinessLabel")}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white/66">
                    {t("panelBusinessBody")}
                  </p>
                  <div className="mt-5 h-2 overflow-hidden bg-white/10">
                    <div className="h-full w-[82%] bg-accent" />
                  </div>
                </div>
                <div className="bg-[#0c1714] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/38">
                    {t("panelDeveloperLabel")}
                  </p>
                  <div className="mt-3 space-y-2">
                    {developerFixes.map((item) => (
                        <p
                          key={item}
                          className="border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-xs leading-6 text-white/68"
                        >
                          <span className="mr-2 text-accent">fix</span>
                          {item}
                        </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border-t border-white/10">
                <table className="min-w-[38rem] w-full text-left text-sm">
                  <thead className="bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-white/36">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Prompt</th>
                      <th className="px-4 py-3 font-semibold">Landing page</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-white/68">
                    {prompts.map((prompt) => (
                      <tr key={prompt.query}>
                        <td className="px-4 py-3">{prompt.query}</td>
                        <td className="px-4 py-3 font-mono text-xs text-white/46">
                          {prompt.page}
                        </td>
                        <td className="px-4 py-3">
                          <span className="border border-accent/30 bg-accent/10 px-2 py-1 text-xs font-semibold text-emerald-100">
                            {prompt.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-white">
                          {prompt.score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
