import { getTranslations } from "next-intl/server";

export async function WorkflowSection() {
  const t = await getTranslations("Workflow");

  const items = [
    { title: t("card1Title"), body: t("card1Body") },
    { title: t("card2Title"), body: t("card2Body") },
    { title: t("card3Title"), body: t("card3Body") },
  ];

  return (
    <section className="border-b border-border bg-paper py-28 sm:py-32 lg:py-40">
      <div className="safe-pad mx-auto max-w-content sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-subtle">
            {t("eyebrow")}
          </p>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-normal text-ink">
            {t("title")}
          </h2>
          <p className="mt-4 max-w-[60ch] text-base leading-[1.6] text-ink-muted sm:text-lg">
            {t("subtitle")}
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.title}
              className="border border-border bg-paper-muted p-5 sm:p-6"
            >
              <h3 className="font-display text-xl font-semibold text-ink">
                {item.title}
              </h3>
              <p className="mt-3 max-w-[60ch] text-base leading-[1.6] text-ink-muted">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
