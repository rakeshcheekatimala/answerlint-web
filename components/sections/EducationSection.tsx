import { getTranslations } from "next-intl/server";

export async function EducationSection() {
  const t = await getTranslations("Education");

  return (
    <section
      id="aeo-geo"
      className="scroll-mt-24 border-b border-border bg-wash py-28 sm:py-32 lg:py-40"
    >
      <div className="safe-pad mx-auto max-w-content sm:px-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-subtle">
          Concepts
        </p>
        <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-normal text-ink">
          {t("title")}
        </h2>
        <p className="mt-4 max-w-[60ch] text-base leading-[1.6] text-ink-muted sm:text-lg">{t("subtitle")}</p>
        <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border lg:grid-cols-2">
          <article className="bg-card p-5 sm:p-8">
            <h3 className="text-xl font-semibold text-ink">
              {t("aeoTitle")}
            </h3>
            <p className="mt-4 max-w-[60ch] text-base leading-[1.6] text-ink-muted">
              {t("aeoBody")}
            </p>
            <p className="mt-6 text-sm font-medium text-accent">{t("aeoProduct")}</p>
          </article>
          <article className="bg-card p-5 sm:p-8">
            <h3 className="text-xl font-semibold text-ink">
              {t("geoTitle")}
            </h3>
            <p className="mt-4 max-w-[60ch] text-base leading-[1.6] text-ink-muted">
              {t("geoBody")}
            </p>
            <p className="mt-6 text-sm font-medium text-accent">{t("geoProduct")}</p>
          </article>
        </div>
      </div>
    </section>
  );
}
