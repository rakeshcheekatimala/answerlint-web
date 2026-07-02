import { getTranslations } from "next-intl/server";

export async function StatsStrip() {
  const t = await getTranslations("Stats");

  const items = [
    { label: t("reports"), value: t("reportsValue") },
    { label: t("inputs"), value: t("inputsValue") },
    { label: t("ci"), value: t("ciValue") },
    { label: t("audiences"), value: t("audiencesValue") },
  ];

  return (
    <div className="border-b border-[#d9e4df] bg-[#f7f8f5]">
      <div className="mx-auto grid max-w-content gap-px border-x border-[#d9e4df] bg-[#d9e4df] px-0 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="bg-card px-4 py-6 sm:px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
              {item.label}
            </p>
            <p className="mt-2 text-lg font-semibold text-ink">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
