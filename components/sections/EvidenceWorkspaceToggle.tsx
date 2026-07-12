"use client";

import { useState } from "react";

import { CodeCopyBlock } from "@/components/CodeCopyBlock";

type View = "business" | "developer";

export function EvidenceWorkspaceToggle({
  businessTitle,
  businessBody,
  businessBullets,
  developerTitle,
  developerBody,
  developerBullets,
}: {
  businessTitle: string;
  businessBody: string;
  businessBullets: string[];
  developerTitle: string;
  developerBody: string;
  developerBullets: string[];
}) {
  const [view, setView] = useState<View>("business");
  const isBusiness = view === "business";

  return (
    <div className="mt-12 border border-border bg-card">
      <div className="grid min-w-0 gap-px border-b border-border bg-border lg:grid-cols-[0.82fr_1.18fr]">
        <div className="min-w-0 bg-card p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-subtle">
            Evidence workspace
          </p>
          <div className="mt-5 grid grid-cols-2 border border-border bg-paper-muted p-1">
            {[
              { id: "business" as const, label: "Business View" },
              { id: "developer" as const, label: "Developer View" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  view === item.id
                    ? "bg-ink text-wash"
                    : "bg-transparent text-ink-muted hover:bg-card hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <h3 className="mt-8 text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            {isBusiness ? businessTitle : developerTitle}
          </h3>
          <p className="mt-4 max-w-[60ch] text-base leading-[1.6] text-ink-muted">
            {isBusiness ? businessBody : developerBody}
          </p>
          <div className="mt-6 grid gap-3">
            {(isBusiness ? businessBullets : developerBullets).map((bullet, index) => (
              <p
                key={bullet}
                className="border border-border bg-paper px-4 py-3 text-sm leading-6 text-ink"
              >
                <span className="mr-3 font-mono text-xs font-semibold text-ink-subtle">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {bullet}
              </p>
            ))}
          </div>
        </div>

        <div className="min-h-[32rem] min-w-0 bg-[#0a0a0a] p-4 text-white sm:p-6">
          {isBusiness ? <BusinessReport /> : <DeveloperReport />}
        </div>
      </div>
    </div>
  );
}

function BusinessReport() {
  const bars = [
    { label: "Composite", value: 82, tone: "bg-score-mid" },
    { label: "AEO", value: 88, tone: "bg-score-mid" },
    { label: "GEO", value: 76, tone: "bg-score-mid" },
  ];

  return (
    <div className="grid h-full content-between gap-8">
      <div>
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/40">
              Executive Summary
            </p>
            <h4 className="mt-2 text-3xl font-semibold text-white">
              Citation share is recoverable.
            </h4>
          </div>
          <span className="border border-score-mid/40 bg-score-mid/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-score-mid">
            Fix queued
          </span>
        </div>
        <p className="mt-5 max-w-[60ch] text-base leading-[1.6] text-white/68">
          The page answers the core buyer question, but weak source attribution
          and missing schema make it easier for competitors to be cited in AI
          summaries.
        </p>
      </div>

      <div className="grid gap-px border border-white/10 bg-white/10">
        {bars.map((bar) => (
          <div key={bar.label} className="bg-[#0a0a0a] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-white/46">
                {bar.label}
              </span>
              <span className="font-mono text-2xl font-semibold text-white">
                {bar.value}
              </span>
            </div>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }).map((_, index) => (
                <span
                  key={index}
                  className={`h-3 ${index < Math.round(bar.value / 10) ? bar.tone : "bg-white/10"}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-3">
        {["Schema gap", "Freshness weak", "Citations thin"].map((label) => (
          <div key={label} className="bg-[#0a0a0a] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/40">
              Risk
            </p>
            <p className="mt-2 text-sm font-semibold text-white/78">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeveloperReport() {
  const terminalOutput = `$ answerlint audit --url "$DEPLOY_URL" --ci
composite 82  floor 70  status pass
aeo       88  answer blocks detected
geo       76  trust signals incomplete

fix queued:
- add FAQPage or HowTo JSON-LD
- expose author + dateModified
- add outbound citations to claims`;

  return (
    <div className="grid h-full gap-4">
      <CodeCopyBlock
        code={terminalOutput}
        label="Terminal output"
        minHeightClassName="min-h-[13.5rem]"
      />

      <div className="border border-white/10 bg-[#050505]">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/40">
            JSON excerpt
          </p>
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-xs leading-6 text-white/70">
          <code>{`{
  "scores": { "composite": 82, "aeo": 88, "geo": 76 },
  "status": "fix_queued",
  "findings": [
    { "id": "schema.faq", "severity": "high" },
    { "id": "meta.freshness", "severity": "medium" }
  ]
}`}</code>
        </pre>
      </div>
    </div>
  );
}
