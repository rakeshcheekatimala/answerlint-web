import { getTranslations } from "next-intl/server";

import { EvidenceWorkspaceToggle } from "@/components/sections/EvidenceWorkspaceToggle";

export async function AudienceSection() {
  const t = await getTranslations("Audience");

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

        <EvidenceWorkspaceToggle
          businessTitle={t("businessTitle")}
          businessBody={t("businessBody")}
          businessBullets={[
            t("businessBullet1"),
            t("businessBullet2"),
            t("businessBullet3"),
          ]}
          developerTitle={t("developerTitle")}
          developerBody={t("developerBody")}
          developerBullets={[
            t("developerBullet1"),
            t("developerBullet2"),
            t("developerBullet3"),
          ]}
        />
      </div>
    </section>
  );
}
