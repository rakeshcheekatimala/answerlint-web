import { getTranslations } from "next-intl/server";

export async function HowSection() {
  const t = await getTranslations("How");

  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
    { title: t("step4Title"), body: t("step4Body") },
  ];

  return (
    <section
      id="how"
      className="scroll-mt-24 border-b border-border bg-paper py-16 sm:py-24"
    >
      <div className="safe-pad mx-auto max-w-content sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
          Audit path
        </p>
        <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
          {t("title")}
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-8 text-ink-muted sm:text-lg">{t("subtitle")}</p>
        <ol className="mt-10 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title} className="relative bg-card p-5">
              <span className="font-mono text-4xl font-semibold text-ink-subtle">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-ink">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
