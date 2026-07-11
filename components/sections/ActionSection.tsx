import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { CodeCopyBlock } from "@/components/CodeCopyBlock";
import { branding } from "@/config/branding";

const citeopsWorkflowYaml = `name: CiteOps audit

on:
  pull_request:
  push:
    branches: [master]

jobs:
  ai-visibility-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx llm-citeops@latest audit --url "$DEPLOY_URL" --ci --threshold 90`;

export async function ActionSection() {
  const t = await getTranslations("Action");

  return (
    <section
      id="action"
      className="scroll-mt-24 border-b border-border bg-wash py-28 sm:py-32 lg:py-40"
    >
      <div className="safe-pad mx-auto max-w-content sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-subtle">
              Ship workflow
            </p>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-normal text-ink">
              {t("title")}
            </h2>
          </div>
          <p className="max-w-[60ch] text-base leading-[1.6] text-ink-muted sm:text-lg">{t("subtitle")}</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8">
          <div className="min-w-0 overflow-hidden border border-border bg-[#0b1210] shadow-soft">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b65]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#f4c358]" />
              <span className="h-2.5 w-2.5 rounded-full bg-accent" />
              <span className="ml-2 text-xs font-bold uppercase tracking-[0.1em] text-white/70">
                citeops overview
              </span>
            </div>
            <Image
              src={branding.overviewImageUrl}
              alt={t("imageAlt")}
              width={1200}
              height={720}
              className="block h-auto w-full max-w-full object-cover object-top"
              sizes="(max-width: 768px) calc(100vw - 2rem), (max-width: 1024px) calc(100vw - 3rem), 50vw"
            />
          </div>
          <div className="min-w-0 border border-border bg-card shadow-soft">
            <div className="border-b border-border p-5 sm:p-6">
              <CodeCopyBlock
                code={citeopsWorkflowYaml}
                label=".github/workflows/citeops.yml"
                minHeightClassName="min-h-[16rem]"
              />
              <PipelineGraphic />
            </div>
            <div className="grid gap-px bg-border">
              {[t("detail1"), t("detail2"), t("detail3")].map((item) => (
                <p
                  key={item}
                  className="bg-card px-5 py-4 text-sm leading-[1.6] text-ink-muted sm:px-6"
                >
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PipelineGraphic() {
  const steps = [
    { label: "Commit", detail: "content change" },
    { label: "GitHub Action", detail: "preview URL" },
    { label: "llm-citeops runs", detail: "AEO + GEO gate" },
    { label: "PR Blocked", detail: "GEO score < 90" },
  ];

  return (
    <div className="mt-5 border border-border bg-paper">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-subtle">
          CI/CD release gate
        </p>
      </div>
      <div className="grid gap-px bg-border md:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.label} className="relative bg-card p-4">
            {index < steps.length - 1 ? (
              <span
                className="absolute right-[-0.7rem] top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rotate-45 border-r border-t border-border bg-card md:block"
                aria-hidden="true"
              />
            ) : null}
            <p
              className={`font-mono text-xs font-semibold ${
                index === steps.length - 1 ? "text-score-low" : "text-ink-subtle"
              }`}
            >
              {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-2 text-sm font-semibold text-ink">{step.label}</h3>
            <p className="mt-1 text-xs leading-5 text-ink-muted">{step.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
