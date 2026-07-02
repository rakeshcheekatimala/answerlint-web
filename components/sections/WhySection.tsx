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
      className="scroll-mt-24 border-b border-border bg-paper py-16 sm:py-24"
    >
      <div className="safe-pad mx-auto max-w-content sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
              Why now
            </p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
              {t("title")}
            </h2>
          </div>
          <div>
            <p className="text-base leading-8 text-ink-muted sm:text-lg">
              {t("lead")}
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <p className="text-base leading-8 text-ink-muted">{t("p1")}</p>
              <p className="text-base leading-8 text-ink-muted">{t("p2")}</p>
            </div>
          </div>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden border border-border bg-border lg:grid-cols-3">
          {problems.map((problem) => (
            <article
              key={problem.title}
              className="bg-card p-6"
            >
              <h3 className="text-xl font-semibold text-ink">
                {problem.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-ink-muted">
                {problem.body}
              </p>
            </article>
          ))}
        </div>
        <blockquote className="mt-12 border-l-4 border-accent pl-6 text-xl font-semibold leading-snug text-ink sm:text-2xl">
          {t("quote")}
        </blockquote>
      </div>
    </section>
  );
}
