"use client";

import { useState } from "react";

type CodeCopyBlockProps = {
  code: string;
  label: string;
  className?: string;
  minHeightClassName?: string;
};

export function CodeCopyBlock({
  code,
  label,
  className = "",
  minHeightClassName = "min-h-[7rem]",
}: CodeCopyBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={`overflow-hidden border border-white/10 bg-[#050505] ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/42">
          {label}
        </p>
        <button
          type="button"
          onClick={copyCode}
          className={`grid h-9 w-9 shrink-0 place-items-center border text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-score-high ${
            copied
              ? "border-score-high bg-score-high/10 text-score-high"
              : "border-white/10 bg-white/[0.04] hover:border-white/30"
          }`}
          aria-label={copied ? "Copied command" : "Copy command"}
          title={copied ? "Copied" : "Copy"}
        >
          {copied ? <CheckIcon /> : <ClipboardIcon />}
        </button>
      </div>
      <pre
        className={`max-w-full overflow-x-auto px-4 py-4 font-mono text-sm leading-6 text-score-high ${minHeightClassName}`}
      >
        <code className="block w-max min-w-full whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

function ClipboardIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
