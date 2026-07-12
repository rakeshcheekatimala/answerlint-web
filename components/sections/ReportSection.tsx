import { getTranslations } from "next-intl/server";

import { CodeCopyBlock } from "@/components/CodeCopyBlock";

export async function ReportSection() {
  const t = await getTranslations("Report");
  const businessItems = [t("business1"), t("business2"), t("business3")];
  const developerItems = [t("developer1"), t("developer2"), t("developer3")];
  const fixes = [
    {
      id: "SEO-124",
      file: "app/content/page.tsx",
      label: "schema",
      text: t("fix1"),
    },
    {
      id: "SEO-125",
      file: "content/sources.md",
      label: "citations",
      text: t("fix2"),
    },
    {
      id: "SEO-126",
      file: "components/faq-jsonld.tsx",
      label: "FAQPage",
      text: t("fix3"),
    },
  ];

  return (
    <section className="border-b border-white/10 bg-[#0a0a0a] py-28 text-white sm:py-32 lg:py-40">
      <div className="safe-pad mx-auto max-w-content sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/42">
              {t("eyebrow")}
            </p>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-normal text-white">
              {t("title")}
            </h2>
          </div>
          <p className="max-w-[60ch] text-base leading-[1.6] text-white/68 sm:text-lg">
            {t("subtitle")}
          </p>
        </div>

        <div className="mt-12 grid min-w-0 auto-rows-[minmax(12rem,auto)] gap-px border border-white/10 bg-white/10 lg:grid-cols-6">
          <article className="min-w-0 bg-white/[0.04] p-5 sm:p-6 lg:col-span-3 lg:row-span-2">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/38">
              {t("businessLabel")}
            </p>
            <h3 className="mt-3 text-3xl font-semibold leading-tight text-white">
              {t("businessTitle")}
            </h3>
            <p className="mt-4 max-w-[60ch] text-base leading-[1.6] text-white/66">
              {t("summaryBody")}
            </p>
            <div className="mt-6 grid gap-3">
              {businessItems.map((item, index) => (
                <div
                  key={item}
                  className="border border-white/10 bg-black/20 px-4 py-3"
                >
                  <p className="font-mono text-xs font-semibold text-score-high">
                    IMPACT {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-2 text-sm leading-[1.6] text-white/68">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="min-w-0 bg-[#050505] p-5 sm:p-6 lg:col-span-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/38">
                  {t("sampleLabel")}
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-white">
                  {t("sampleTitle")}
                </h3>
              </div>
              <span className="border border-score-mid/40 bg-score-mid/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-score-mid">
                {t("sampleStatus")}
              </span>
            </div>
            <div className="mt-6 grid gap-px bg-white/10 sm:grid-cols-3">
              {[
                { label: "Composite", value: "74" },
                { label: "AEO", value: "81" },
                { label: "GEO", value: "68" },
              ].map((score) => (
                <div key={score.label} className="min-h-28 bg-[#050505] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/38">
                    {score.label}
                  </p>
                  <p className="mt-3 font-mono text-5xl font-semibold text-score-mid">
                    {score.value}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="min-w-0 bg-white/[0.04] p-5 sm:p-6 lg:col-span-2">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/38">
              {t("developerLabel")}
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              {t("developerTitle")}
            </h3>
            <div className="mt-5 grid gap-3">
              {developerItems.map((item, index) => (
                <p
                  key={item}
                  className="border border-white/10 bg-black/20 px-4 py-3 text-sm leading-[1.6] text-white/68"
                >
                  <span className="mr-3 font-mono text-xs text-score-mid">
                    DEV-{index + 1}
                  </span>
                  {item}
                </p>
              ))}
            </div>
          </article>

          <article className="min-w-0 bg-[#050505] p-5 sm:p-6 lg:col-span-2">
            <CodeCopyBlock
              code={'answerlint audit --url "$DEPLOY_URL" --ci --threshold 90'}
              label="CI command"
              minHeightClassName="min-h-[5.5rem]"
            />
            <div className="mt-4 grid gap-px bg-white/10">
              {["commit", "audit", "block if GEO < 90"].map((item, index) => (
                <div key={item} className="bg-[#050505] px-4 py-3">
                  <p className="font-mono text-xs text-white/34">
                    {String(index + 1).padStart(2, "0")} / {item}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="min-w-0 bg-[#050505] p-5 sm:p-6 lg:col-span-2">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/38">
              {t("fixesLabel")}
            </p>
            <div className="mt-3 space-y-3">
              {fixes.map((fix) => (
                <div key={fix.id} className="border border-white/10 bg-white/[0.04]">
                  <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2">
                    <span className="font-mono text-xs font-semibold text-score-mid">
                      #{fix.id}
                    </span>
                    <span className="border border-score-high/30 bg-score-high/10 px-2 py-1 text-xs font-bold uppercase tracking-[0.1em] text-score-high">
                      {fix.label}
                    </span>
                    <span className="font-mono text-xs text-white/36">
                      {fix.file}
                    </span>
                  </div>
                  <p className="px-4 py-3 text-sm leading-[1.6] text-white/68">
                    {fix.text}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
