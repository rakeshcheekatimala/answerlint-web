"use client";

import { useState } from "react";

type Perspective = "business" | "developer";

const perspectiveCopy: Record<
  Perspective,
  {
    title: string;
    body: string;
    points: string[];
  }
> = {
  business: {
    title: "For executives: see AI visibility risk in one dashboard.",
    body: "Start with commercial impact, competitor exposure, and the pages most likely to lose AI citation share.",
    points: [
      "Prioritize revenue and trust pages first.",
      "Explain whether AI systems can quote the page.",
      "Turn audit gaps into a short fix plan.",
    ],
  },
  developer: {
    title: "For developers: wire AI visibility into CI.",
    body: "Run deterministic checks locally, in preview, or in GitHub Actions with exit codes that can block a pull request.",
    points: [
      "Export JSON, HTML, and CSV for automation.",
      "Fail builds when AEO or GEO drops below threshold.",
      "Debug schema, metadata, citations, and answer structure.",
    ],
  },
};

export function HeroPerspectiveSwitch() {
  const [perspective, setPerspective] = useState<Perspective>("business");
  const active = perspectiveCopy[perspective];

  return (
    <div className="mt-8 border border-white/10 bg-white/[0.035]">
      <div className="grid grid-cols-2 gap-px bg-white/10 p-1">
        {[
          { id: "business" as const, label: "Business View" },
          { id: "developer" as const, label: "Developer View" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPerspective(item.id)}
            className={`px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-score-high ${
              perspective === item.id
                ? "bg-score-high text-[#0a0a0a]"
                : "bg-[#050505] text-white/54 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="min-h-[13rem] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/34">
          Immediate path
        </p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight text-white">
          {active.title}
        </h2>
        <p className="mt-3 max-w-[60ch] text-sm leading-[1.6] text-white/66">
          {active.body}
        </p>
        <div className="mt-4 grid gap-2">
          {active.points.map((point) => (
            <p key={point} className="text-sm leading-6 text-white/70">
              <span className="mr-2 font-mono text-score-high">✓</span>
              {point}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
