import { getTranslations } from "next-intl/server";

type Feature = {
  label: string;
  answerlint: string;
  manual: string;
  generic: string;
  manualPass: boolean;
  genericPass: boolean;
};

export async function ComparisonSection() {
  const t = await getTranslations("Comparison");

  const features: Feature[] = [
    {
      label: t("row1Label"),
      answerlint: t("row1AnswerLint"),
      manual: t("row1Manual"),
      generic: t("row1Generic"),
      manualPass: false,
      genericPass: false,
    },
    {
      label: t("row2Label"),
      answerlint: t("row2AnswerLint"),
      manual: t("row2Manual"),
      generic: t("row2Generic"),
      manualPass: false,
      genericPass: false,
    },
    {
      label: t("row3Label"),
      answerlint: t("row3AnswerLint"),
      manual: t("row3Manual"),
      generic: t("row3Generic"),
      manualPass: false,
      genericPass: false,
    },
    {
      label: t("row4Label"),
      answerlint: t("row4AnswerLint"),
      manual: t("row4Manual"),
      generic: t("row4Generic"),
      manualPass: true,
      genericPass: true,
    },
  ];

  return (
    <section
      id="comparison"
      className="scroll-mt-24 border-b border-border bg-paper py-28 sm:py-32 lg:py-40"
    >
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

        <div className="mt-12 grid gap-px border border-border bg-border lg:grid-cols-3">
          <ComparisonColumn
            heading={t("col2")}
            label="Deterministic release tool"
            featured
            features={features.map((feature) => ({
              title: feature.label,
              body: feature.answerlint,
              pass: true,
            }))}
          />
          <ComparisonColumn
            heading={t("col3")}
            label="Human review"
            features={features.map((feature) => ({
              title: feature.label,
              body: feature.manual,
              pass: feature.manualPass,
            }))}
          />
          <ComparisonColumn
            heading={t("col4")}
            label="Prompted summary"
            features={features.map((feature) => ({
              title: feature.label,
              body: feature.generic,
              pass: feature.genericPass,
            }))}
          />
        </div>
      </div>
    </section>
  );
}

function ComparisonColumn({
  heading,
  label,
  features,
  featured = false,
}: {
  heading: string;
  label: string;
  features: { title: string; body: string; pass: boolean }[];
  featured?: boolean;
}) {
  return (
    <article className={`${featured ? "bg-[#0a0a0a] text-white" : "bg-card text-ink"} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          className={`text-xs font-bold uppercase tracking-[0.1em] ${
            featured ? "text-score-high" : "text-ink-subtle"
          }`}
        >
          {label}
        </p>
        {featured ? (
          <span className="border border-score-high/40 bg-score-high/10 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.1em] text-score-high">
            Opinionated pick
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 text-2xl font-semibold">{heading}</h3>
      <div className="mt-6 grid gap-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className={`border p-4 ${
              featured
                ? "border-white/10 bg-white/[0.04]"
                : "border-border bg-paper"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center border font-mono text-sm font-semibold ${
                  feature.pass
                    ? featured
                      ? "border-score-high text-score-high"
                      : "border-emerald-600 text-emerald-700"
                    : featured
                      ? "border-white/20 text-white/34"
                      : "border-border-strong text-ink-subtle"
                }`}
                aria-hidden="true"
              >
                {feature.pass ? "✓" : "—"}
              </span>
              <div>
                <p className="text-sm font-semibold">{feature.title}</p>
                <p
                  className={`mt-2 max-w-[60ch] text-sm leading-[1.6] ${
                    featured ? "text-white/62" : "text-ink-muted"
                  }`}
                >
                  {feature.body}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
