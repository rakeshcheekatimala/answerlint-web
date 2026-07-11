"use client";

import { useEffect, useMemo, useState } from "react";

type TerminalLine = {
  text: string;
  tone?: "muted" | "success" | "warn" | "error" | "info";
};

const terminalLines: TerminalLine[] = [
  { text: "$ npx llm-citeops@latest audit --url https://website.com", tone: "info" },
  { text: "fetch  sitemap.xml discovered 42 urls", tone: "muted" },
  { text: "crawl  selected /pricing, /docs, /compare for audit", tone: "muted" },
  { text: "pass   robots and canonical signals detected", tone: "success" },
  { text: "pass   answer-first headings found", tone: "success" },
  { text: "warn   FAQPage schema missing on /compare", tone: "warn" },
  { text: "warn   dateModified missing on /docs", tone: "warn" },
  { text: "score  composite 82  aeo 88  geo 76", tone: "info" },
  { text: "fail   GEO threshold 90 not met", tone: "error" },
  { text: "Process exited with code 1 (Threshold failed)", tone: "error" },
];

const toneClass: Record<NonNullable<TerminalLine["tone"]>, string> = {
  muted: "text-white/46",
  success: "text-score-high",
  warn: "text-score-mid",
  error: "text-score-low",
  info: "text-white",
};

export function LiveTerminalDemo() {
  const [visibleCount, setVisibleCount] = useState(terminalLines.length);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setVisibleCount(terminalLines.length);
      return;
    }

    setVisibleCount(1);
    const timer = window.setInterval(() => {
      setVisibleCount((count) => {
        if (count >= terminalLines.length) {
          window.clearInterval(timer);
          return count;
        }

        return count + 1;
      });
    }, 360);

    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  return (
    <div className="border border-white/10 bg-[#050505]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-score-low" />
          <span className="h-2.5 w-2.5 rounded-full bg-score-mid" />
          <span className="h-2.5 w-2.5 rounded-full bg-score-high" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/42">
          live CLI simulation
        </p>
      </div>
      <div className="min-h-[20rem] overflow-hidden p-4 font-mono text-xs leading-6 sm:text-sm">
        {terminalLines.slice(0, visibleCount).map((line, index) => (
          <p key={`${line.text}-${index}`} className={toneClass[line.tone ?? "muted"]}>
            {line.text}
          </p>
        ))}
        {visibleCount < terminalLines.length ? (
          <span className="mt-1 inline-block h-4 w-2 animate-pulse bg-score-high" />
        ) : null}
      </div>
    </div>
  );
}
