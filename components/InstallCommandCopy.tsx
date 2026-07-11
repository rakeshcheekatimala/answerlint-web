"use client";

import { useState } from "react";

export function InstallCommandCopy({
  command,
  label,
}: {
  command: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCommand() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="overflow-hidden border border-white/10 bg-[#050505]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/42">
          {label}
        </p>
        <button
          type="button"
          onClick={copyCommand}
          className="border border-white/10 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#0a0a0a] transition-colors hover:bg-score-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-score-high"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code className="block overflow-x-auto px-4 py-4 font-mono text-sm text-score-high">
        {command}
      </code>
    </div>
  );
}
