import { getTranslations } from "next-intl/server";

import { SiteHeaderClient } from "@/components/SiteHeaderClient";
import { branding } from "@/config/branding";

const navKeys = [
  { href: "/docs/getting-started/installation", key: "docs" as const },
  { href: "/#why", key: "why" as const },
  { href: "/#aeo-geo", key: "aeoGeo" as const },
  { href: "/#how", key: "how" as const },
  { href: "/#product", key: "product" as const },
  { href: "/#reviews", key: "reviews" as const },
];

const toolKeys = [
  { href: "/playground", key: "playground" as const },
  { href: "/tools/business-aware-scan", key: "businessScan" as const },
  { href: "/tools/llms-txt", key: "llmsTxt" as const },
];

export async function SiteHeader() {
  const t = await getTranslations("Nav");
  const tBrand = await getTranslations("branding");
  const items = navKeys.map(({ href, key }) => ({ href, label: t(key) }));
  const toolItems = toolKeys.map(({ href, key }) => ({ href, label: t(key) }));

  return (
    <SiteHeaderClient
      githubLabel={t("github")}
      githubUrl={branding.links.github}
      displayName={branding.displayName}
      logoAlt={tBrand("logoAlt")}
      menuCloseLabel={t("closeMenu")}
      menuLabel={t("menu")}
      navItems={items}
      toolItems={toolItems}
      toolsLabel={t("tools")}
      npmLabel={t("npm")}
      npmUrl={branding.links.npm}
    />
  );
}
