import { getTranslations } from "next-intl/server";

export async function ProductSection() {
  const t = await getTranslations("Product");

  const cards = [
    { title: t("card1Title"), body: t("card1Body") },
    { title: t("card2Title"), body: t("card2Body") },
    { title: t("card3Title"), body: t("card3Body") },
    { title: t("card4Title"), body: t("card4Body") },
    { title: t("card5Title"), body: t("card5Body") },
    { title: t("card6Title"), body: t("card6Body") },
  ];
  const highlights = [t("highlight1"), t("highlight2"), t("highlight3")];

  return (
    <section
      id="product"
      className="scroll-mt-24 border-b border-border bg-paper py-16 sm:py-24"
    >
      <div className="safe-pad mx-auto max-w-content sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
              Product layer
            </p>
            <h2 className="mt-4 max-w-3xl font-display text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
              {t("title")}
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-ink-muted sm:text-lg">
            {t("subtitle")}
          </p>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden border border-border bg-border lg:grid-cols-3">
          {highlights.map((item) => (
            <div key={item} className="bg-[#0d1715] p-5 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/36">
                Operating principle
              </p>
              <p className="mt-3 text-base font-semibold leading-7">{item}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.title}
              className="bg-card p-6 transition-colors hover:bg-wash"
            >
              <h3 className="text-lg font-semibold text-ink">
                {card.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                {card.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
