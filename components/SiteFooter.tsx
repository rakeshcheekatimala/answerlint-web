import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { branding } from "@/config/branding";

export async function SiteFooter() {
  const t = await getTranslations("Footer");

  return (
    <footer className="border-t border-border bg-paper-muted">
      <div className="mx-auto max-w-content px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm text-ink-muted">{t("rights")}</p>
          <div className="flex gap-6">
            <Link
              href="/tools/llms-txt"
              className="text-sm font-medium text-accent hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t("llmsTxt")}
            </Link>
            <Link
              href="/reviews/new"
              className="text-sm font-medium text-accent hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t("review")}
            </Link>
            <Link
              href="/docs/getting-started/installation"
              className="text-sm font-medium text-accent hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t("docs")}
            </Link>
            <a
              href={branding.links.github}
              className="text-sm font-medium text-accent hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("github")}
            </a>
            <a
              href={branding.links.npm}
              className="text-sm font-medium text-accent hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("npm")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
