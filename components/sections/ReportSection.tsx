import { getTranslations } from "next-intl/server";

export async function ReportSection() {
  const t = await getTranslations("Report");

  return (
    <section className="border-b border-white/10 bg-[#0a1311] py-16 text-white sm:py-24">
      <div className="safe-pad mx-auto max-w-content sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100/70">
              {t("eyebrow")}
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              {t("title")}
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/68 sm:text-lg">
              {t("subtitle")}
            </p>

            <div className="mt-8 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2">
              <article className="bg-white/[0.04] p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/38">
                  {t("businessLabel")}
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-white">
                  {t("businessTitle")}
                </h3>
                <div className="mt-4 space-y-3">
                  {[t("business1"), t("business2"), t("business3")].map((item) => (
                    <p
                      key={item}
                      className="border border-white/10 bg-black/18 px-4 py-3 text-sm leading-7 text-white/66"
                    >
                      {item}
                    </p>
                  ))}
                </div>
              </article>

              <article className="bg-white/[0.04] p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/38">
                  {t("developerLabel")}
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-white">
                  {t("developerTitle")}
                </h3>
                <div className="mt-4 space-y-3">
                  {[t("developer1"), t("developer2"), t("developer3")].map((item) => (
                    <p
                      key={item}
                      className="border border-white/10 bg-black/18 px-4 py-3 text-sm leading-7 text-white/66"
                    >
                      {item}
                    </p>
                  ))}
                </div>
              </article>
            </div>
          </div>

          <div className="border border-white/10 bg-white/[0.05] p-3 shadow-[0_26px_70px_rgba(0,0,0,0.25)]">
            <div className="bg-[#101b18]">
              <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/38">
                    {t("sampleLabel")}
                  </p>
                  <h3 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
                    {t("sampleTitle")}
                  </h3>
                </div>
              </div>

              <div className="grid gap-px bg-white/10 sm:grid-cols-3">
                {[
                  { label: "Composite", value: "74" },
                  { label: "AEO", value: "81" },
                  { label: "GEO", value: "68" },
                ].map((score) => (
                  <div
                    key={score.label}
                    className="bg-[#101b18] p-5"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">
                      {score.label}
                    </p>
                    <p className="mt-3 font-mono text-5xl font-semibold text-white">
                      {score.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-px bg-white/10">
                <div className="bg-[#101b18] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/38">
                    {t("summaryLabel")}
                  </p>
                  <p className="mt-4 text-base leading-8 text-white/66">
                    {t("summaryBody")}
                  </p>
                </div>
                <div className="bg-[#101b18] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/38">
                    {t("fixesLabel")}
                  </p>
                  <div className="mt-3 space-y-3">
                    {[t("fix1"), t("fix2"), t("fix3")].map((item) => (
                      <p
                        key={item}
                        className="border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-7 text-white/66"
                      >
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
