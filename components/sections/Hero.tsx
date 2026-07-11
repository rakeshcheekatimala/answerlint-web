import type { CSSProperties } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { CodeCopyBlock } from "@/components/CodeCopyBlock";
import { HeroPerspectiveSwitch } from "@/components/sections/HeroPerspectiveSwitch";
import { LiveTerminalDemo } from "@/components/sections/LiveTerminalDemo";
import { branding } from "@/config/branding";

type ScoreTone = "high" | "mid" | "low";

const scoreToneClass: Record<ScoreTone, string> = {
  high: "text-score-high",
  mid: "text-score-mid",
  low: "text-score-low",
};

export async function Hero() {
  const t = await getTranslations("Hero");
  const prompts = [
    {
      query: "best tools for AI visibility audits",
      page: "/compare/ai-visibility",
      status: "PASSING",
      score: 91,
      tone: "high" as const,
    },
    {
      query: "AEO checklist for launch pages",
      page: "/docs/aeo-checklist",
      status: "FIX QUEUED",
      score: 64,
      tone: "mid" as const,
    },
    {
      query: "GEO audit in CI pipeline",
      page: "/guides/ci",
      status: "AT RISK",
      score: 44,
      tone: "low" as const,
    },
  ];
  return (
    <section
      id="top"
      className="relative overflow-hidden border-b border-white/10 bg-[#0a0a0a] text-white"
    >
      <div className="enterprise-grid absolute inset-0 opacity-45" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/20" />

      <div className="safe-pad relative mx-auto max-w-[82rem] pb-24 pt-16 sm:px-6 sm:pb-32 sm:pt-20 lg:px-8 lg:pb-40 lg:pt-24">
        <div className="grid gap-10 xl:grid-cols-[1.02fr_0.98fr] xl:items-center xl:gap-12">
          <div className="relative">
            <p className="mb-5 inline-flex border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-score-high">
              {t("eyebrow")}
            </p>

            <h1 className="font-display text-balance text-5xl font-semibold leading-[1.05] tracking-normal text-white sm:text-[64px] lg:text-[72px]">
              {t("title")}
            </h1>
            <p className="mt-6 max-w-[60ch] text-lg leading-[1.6] text-white/72">
              {t("subtitle")}
            </p>

            <div className="mt-8 max-w-xl">
              <CodeCopyBlock
                code="npx answerlint@latest audit --url https://website.com"
                label="Instant validation"
                minHeightClassName="min-h-[4.75rem]"
              />
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/tools/business-aware-scan"
                className="inline-flex w-full items-center justify-center border border-score-high bg-score-high px-5 py-3 text-sm font-bold text-[#0a0a0a] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-score-high sm:w-auto"
              >
                {t("ctaBusinessScan")}
              </Link>

              <Link
                href="/playground"
                className="inline-flex w-full items-center justify-center border border-white/15 bg-white px-5 py-3 text-sm font-bold text-[#0a0a0a] transition-colors hover:bg-paper-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-score-high sm:w-auto"
              >
                {t("ctaPlayground")}
              </Link>

              <a
                href={branding.links.github}
                className="inline-flex w-full items-center justify-center border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white/80 transition-colors hover:border-white/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-score-high sm:w-auto"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("ctaGithub")}
              </a>
            </div>

            <HeroPerspectiveSwitch />
          </div>

          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-8"
              style={{
                background:
                  "radial-gradient(circle at center, rgba(204, 255, 0, 0.11) 0%, transparent 70%)",
              }}
              aria-hidden="true"
            />
            <div className="relative border border-white/10 bg-white/[0.035] p-3">
              <div className="border border-white/10 bg-[#050505]">
                <div className="flex flex-col gap-4 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/40">
                      {t("panelLabel")}
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-semibold text-white sm:text-4xl">
                      {t("panelTitle")}
                    </h2>
                  </div>
                  <div className="border border-score-high/40 bg-score-high/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-score-high">
                    LIVE AUDIT
                  </div>
                </div>

                <LiveTerminalDemo />

                <div className="grid gap-px border-y border-white/10 bg-white/10 sm:grid-cols-3">
                  {[
                    { label: "Composite", value: 82, delta: "+12 vs floor" },
                    { label: "AEO", value: 88, delta: "answer ready" },
                    { label: "GEO", value: 76, delta: "trust gaps" },
                  ].map((score) => (
                    <ScoreRing
                      key={score.label}
                      label={score.label}
                      value={score.value}
                      delta={score.delta}
                    />
                  ))}
                </div>

                <div className="grid gap-px border-t border-white/10 bg-white/10">
                  {prompts.map((prompt) => (
                    <div
                      key={prompt.query}
                      className="grid gap-3 bg-[#050505] p-4 text-sm text-white/68 sm:grid-cols-[1.2fr_0.85fr_auto_auto] sm:items-center"
                    >
                      <p>{prompt.query}</p>
                      <p className="font-mono text-xs text-white/46">
                        {prompt.page}
                      </p>
                      <span
                        className={`w-fit border px-2 py-1 text-xs font-bold uppercase tracking-[0.1em] ${scoreToneClass[prompt.tone]} border-white/10 bg-white/[0.04]`}
                      >
                        {prompt.status}
                      </span>
                      <span
                        className={`font-mono text-2xl font-semibold ${scoreToneClass[prompt.tone]}`}
                      >
                        {prompt.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScoreRing({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta: string;
}) {
  const tone = getTone(value);
  const style = {
    "--score-value": `${value * 3.6}deg`,
    "--score-color":
      tone === "high"
        ? "var(--score-high)"
        : tone === "mid"
          ? "var(--score-mid)"
          : "var(--score-low)",
  } as CSSProperties;

  return (
    <div className="bg-[#050505] p-4 text-left">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/38">
        {label}
      </p>
      <div className="mt-4 flex items-center gap-4">
        <div
          className="grid h-24 w-24 place-items-center rounded-full"
          style={{
            ...style,
            background:
              "conic-gradient(var(--score-color) var(--score-value), rgb(255 255 255 / 0.1) 0)",
          }}
        >
          <div className="grid h-[4.4rem] w-[4.4rem] place-items-center rounded-full bg-[#050505]">
            <span className={`font-mono text-3xl font-semibold ${scoreToneClass[tone]}`}>
              {value}
            </span>
          </div>
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/46">
          {delta}
        </p>
      </div>
    </div>
  );
}

function getTone(value: number): ScoreTone {
  if (value >= 90) {
    return "high";
  }
  if (value >= 50) {
    return "mid";
  }
  return "low";
}
