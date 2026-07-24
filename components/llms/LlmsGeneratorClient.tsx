"use client";

import {
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";

import type { LlmsGenerationResult } from "@/lib/llms/types";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; result: LlmsGenerationResult };

export function LlmsGeneratorClient() {
  const [url, setUrl] = useState("");
  const [publicSite, setPublicSite] = useState("");
  const [siteName, setSiteName] = useState("");
  const [summary, setSummary] = useState("");
  const [includeFull, setIncludeFull] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "loading" });
    setCopied(false);

    try {
      const response = await fetch("/api/llms/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, publicSite, siteName, summary, includeFull }),
      });
      const payload = (await response.json()) as LlmsGenerationResult & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Generation failed.");
      setStatus({ kind: "ready", result: payload });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Unable to generate llms.txt.",
      });
    }
  }

  async function copy(content: string) {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-start">
      <form
        onSubmit={generate}
        className="border border-border bg-card p-5 shadow-soft sm:p-7"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Source
            </p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Public website</h2>
          </div>
          <span className="border border-border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            No AI key
          </span>
        </div>

        <Field
          className="mt-6"
          label="Website URL"
          hint="AnswerLint will check the sitemap first, then same-site links."
          value={url}
          onChange={setUrl}
          type="url"
          placeholder="https://example.com"
          required
        />

        <button
          type="button"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((value) => !value)}
          className="mt-6 flex min-h-11 w-full items-center justify-between border-y border-border py-3 text-left text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span>Production URL and metadata</span>
          <span aria-hidden="true" className="font-mono text-ink-subtle">
            {advancedOpen ? "−" : "+"}
          </span>
        </button>

        {advancedOpen ? (
          <div className="grid gap-5 border-b border-border py-6">
            <Field
              label="Production site URL"
              hint="Optional. Use this when crawling a preview or staging site."
              value={publicSite}
              onChange={setPublicSite}
              type="url"
              placeholder="https://example.com"
            />
            <Field
              label="Site name"
              hint="Optional. Otherwise inferred from the hostname."
              value={siteName}
              onChange={setSiteName}
              placeholder="Example Site"
              maxLength={100}
            />
            <label className="block text-sm font-semibold text-ink">
              Site summary
              <span className="mt-1 block text-xs font-normal leading-relaxed text-ink-subtle">
                Optional. One factual sentence for agents reading the roadmap.
              </span>
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Example Site publishes product docs and implementation guides."
                className="mt-2 w-full resize-y border border-border bg-paper px-3 py-3 font-normal leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink"
              />
              <span className="mt-1 block text-right font-mono text-[10px] font-normal text-ink-subtle">
                {summary.length}/300
              </span>
            </label>
          </div>
        ) : null}

        <label className="mt-6 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={includeFull}
            onChange={(event) => setIncludeFull(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-ink"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">
              Also generate llms-full.txt
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-ink-subtle">
              Includes cleaned page context for deeper agent retrieval.
            </span>
          </span>
        </label>

        {status.kind === "error" ? (
          <p
            role="alert"
            className="mt-5 border border-score-low/30 bg-score-low/5 px-4 py-3 text-sm text-score-low"
          >
            {status.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={status.kind === "loading"}
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center bg-ink px-5 py-3 text-sm font-semibold text-paper transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
        >
          {status.kind === "loading" ? "Discovering site content…" : "Generate AI roadmap"}
        </button>
        <p className="mt-3 text-center text-xs leading-relaxed text-ink-subtle">
          Up to 20 public pages. Respect the site’s terms and crawling policies.
        </p>
      </form>

      <section
        aria-live="polite"
        className="min-h-[36rem] overflow-hidden border border-border bg-[#0a0a0a] text-white shadow-soft"
      >
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Generated output
            </p>
            <p className="mt-1 text-sm font-semibold text-white">llms.txt</p>
          </div>
          {status.kind === "ready" ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copy(status.result.llmsTxt)}
                className="min-h-9 border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:border-white/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-score-high"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <DownloadButton filename="llms.txt" content={status.result.llmsTxt} />
            </div>
          ) : null}
        </div>

        {status.kind === "ready" ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-5 py-3 text-xs text-white/55">
              <span className="bg-score-high px-2 py-1 font-mono font-semibold text-ink">
                Valid
              </span>
              <span>{status.result.sourceCount} sources</span>
              <span aria-hidden="true">·</span>
              <span>Deterministic extraction</span>
              {status.result.llmsFullTxt ? (
                <DownloadButton
                  filename="llms-full.txt"
                  content={status.result.llmsFullTxt}
                  compact
                />
              ) : null}
            </div>
            {status.result.warnings.map((warning) => (
              <p key={warning} className="border-b border-white/10 px-5 py-3 text-xs text-score-mid">
                {warning}
              </p>
            ))}
            <pre className="max-h-[42rem] overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-6 text-white/78 sm:p-6">
              {status.result.llmsTxt}
            </pre>
          </>
        ) : (
          <div className="grid min-h-[30rem] place-items-center p-8 text-center">
            <div className="max-w-sm">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
                Ready to generate
              </p>
              <p className="mt-4 text-lg font-semibold text-white">
                Your roadmap preview will appear here.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/50">
                Review every link before publishing the files at the root of your site.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  className = "",
  value,
  onChange,
  ...props
}: {
  label: string;
  hint: string;
  className?: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className={`block text-sm font-semibold text-ink ${className}`}>
      {label}
      <span className="mt-1 block text-xs font-normal leading-relaxed text-ink-subtle">
        {hint}
      </span>
      <input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full border border-border bg-paper px-3 py-2 font-normal text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink"
      />
    </label>
  );
}

function DownloadButton({
  filename,
  content,
  compact = false,
}: {
  filename: string;
  content: string;
  compact?: boolean;
}) {
  function download() {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <button
      type="button"
      onClick={download}
      className={
        compact
          ? "ml-auto min-h-8 border border-white/15 px-2.5 py-1.5 font-semibold text-white/75 hover:border-white/35 hover:text-white"
          : "min-h-9 bg-white px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-paper-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-score-high"
      }
    >
      Download {filename}
    </button>
  );
}
