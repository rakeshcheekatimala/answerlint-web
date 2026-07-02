import { getTranslations } from "next-intl/server";

export async function EducationSection() {
  const t = await getTranslations("Education");

  return (
    <section
      id="aeo-geo"
      className="scroll-mt-24 border-b border-border bg-wash py-16 sm:py-24"
    >
      <div className="safe-pad mx-auto max-w-content sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
          Concepts
        </p>
        <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
          {t("title")}
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-8 text-ink-muted sm:text-lg">{t("subtitle")}</p>
        <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border lg:grid-cols-2">
          <article className="bg-card p-5 sm:p-8">
            <h3 className="text-xl font-semibold text-ink">
              {t("aeoTitle")}
            </h3>
            <p className="mt-4 text-base leading-relaxed text-ink-muted">
              {t("aeoBody")}
            </p>
            <p className="mt-6 text-sm font-medium text-accent">{t("aeoProduct")}</p>
          </article>
          <article className="bg-card p-5 sm:p-8">
            <h3 className="text-xl font-semibold text-ink">
              {t("geoTitle")}
            </h3>
            <p className="mt-4 text-base leading-relaxed text-ink-muted">
              {t("geoBody")}
            </p>
            <p className="mt-6 text-sm font-medium text-accent">{t("geoProduct")}</p>
          </article>
        </div>
      </div>
    </section>
  );
}
