import Image from "next/image";
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
      className="scroll-mt-24 border-b border-border bg-paper py-28 sm:py-32 lg:py-40"
    >
      <div className="safe-pad mx-auto max-w-content sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-subtle">
          {t("eyebrow")}
        </p>
        <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-normal text-ink">
          {t("title")}
        </h2>
        <p className="mt-4 max-w-[60ch] text-base leading-[1.6] text-ink-muted sm:text-lg">{t("subtitle")}</p>
        <div className="mt-10 border border-border bg-[#050505] p-2 shadow-soft sm:p-3">
          <Image
            src="/brand/how-answerlint-works.png"
            alt={t("imageAlt")}
            width={1586}
            height={992}
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="h-auto w-full"
            priority
          />
          <div className="flex items-center justify-between gap-4 border-t border-white/10 px-2 pb-1 pt-3 sm:px-3">
            <p className="text-xs text-white/46 sm:hidden">{t("mobileImageHint")}</p>
            <a
              href="/brand/how-answerlint-works.png"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs font-semibold text-score-high underline decoration-score-high/40 underline-offset-4 hover:decoration-score-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-score-high"
            >
              {t("openImage")}
            </a>
          </div>
        </div>
        <ol className="mt-6 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title} className="relative bg-card p-5">
              <span className="font-mono text-4xl font-semibold text-ink-subtle">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-ink">
                {step.title}
              </h3>
              <p className="mt-3 max-w-[60ch] text-sm leading-[1.6] text-ink-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
