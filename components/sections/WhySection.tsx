import { getTranslations } from "next-intl/server";

export async function WhySection() {
  const t = await getTranslations("Why");
  const problems = [
    { title: t("card1Title"), body: t("card1Body") },
    { title: t("card2Title"), body: t("card2Body") },
    { title: t("card3Title"), body: t("card3Body") },
  ];

  return (
    <section
      id="why"
      className="scroll-mt-24 border-b border-border bg-paper py-28 sm:py-32 lg:py-40"
    >
      <div className="safe-pad mx-auto max-w-content sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-subtle">
              Why now
            </p>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-normal text-ink">
              {t("title")}
            </h2>
            <p className="mt-5 max-w-[60ch] text-base leading-[1.6] text-ink-muted sm:text-lg">
              {t("lead")}
            </p>
            <div className="mt-8 grid gap-4">
              <p className="max-w-[60ch] text-base leading-[1.6] text-ink-muted">
                {t("p1")}
              </p>
              <p className="max-w-[60ch] text-base leading-[1.6] text-ink-muted">
                {t("p2")}
              </p>
            </div>
          </div>

          <SearchShiftVisual />
        </div>

        <div className="mt-16 grid gap-px border border-border bg-border lg:grid-cols-3">
          {problems.map((problem) => (
            <article key={problem.title} className="bg-card p-6">
              <p className="font-mono text-xs font-semibold text-ink-subtle">
                RISK
              </p>
              <h3 className="mt-3 text-xl font-semibold text-ink">
                {problem.title}
              </h3>
              <p className="mt-3 max-w-[60ch] text-sm leading-[1.6] text-ink-muted">
                {problem.body}
              </p>
            </article>
          ))}
        </div>
        <blockquote className="mt-16 border-l-4 border-score-mid pl-6 text-2xl font-semibold leading-tight text-ink sm:text-3xl">
          {t("quote")}
        </blockquote>
      </div>
    </section>
  );
}

function SearchShiftVisual() {
  return (
    <div className="border border-border bg-card p-4">
      <div className="border border-border bg-[#0a0a0a] p-5 text-white">
        <div className="grid gap-px bg-white/10">
          <div className="bg-[#0a0a0a] p-4 opacity-45">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/36">
              Standard SEO result
            </p>
            <p className="mt-3 text-lg font-semibold text-[#2f6fff]">
              10 blue links for &quot;AI visibility audit&quot;
            </p>
            <p className="mt-2 max-w-[60ch] text-sm leading-[1.6] text-white/48">
              Ranking still matters, but the click path is increasingly hidden
              behind generated answers.
            </p>
          </div>

          <div className="bg-[#0a0a0a] p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-score-high">
                AI citation layer
              </p>
              <span className="border border-score-high/40 bg-score-high/10 px-2 py-1 font-mono text-xs font-semibold text-score-high">
                +31 cite fit
              </span>
            </div>
            <div className="mt-4 border border-white/10 bg-white/[0.04] p-4">
              <p className="text-base font-semibold leading-7 text-white">
                &quot;AnswerLint identifies missing FAQ schema, freshness metadata, and
                citation gaps before launch.&quot;
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {["Answer block", "Trusted source", "Release gate"].map((item) => (
                  <span
                    key={item}
                    className="border border-white/10 bg-[#050505] px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white/54"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
