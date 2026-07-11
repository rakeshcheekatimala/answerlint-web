import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { CodeCopyBlock } from "@/components/CodeCopyBlock";
import { branding } from "@/config/branding";

export async function CtaSection() {
  const t = await getTranslations("Cta");

  return (
    <section className="bg-paper py-28 sm:py-32 lg:py-40">
      <div className="safe-pad mx-auto max-w-content text-center sm:px-6 lg:px-8">
        <h2 className="font-display text-balance text-4xl font-semibold leading-tight tracking-normal text-ink">
          {t("title")}
        </h2>
        <p className="mx-auto mt-6 max-w-[60ch] text-base leading-[1.6] text-ink-muted sm:text-lg">
          {t("subtitle")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {[t("pill1"), t("pill2"), t("pill3")].map((item) => (
            <span
              key={item}
              className="rounded-full border border-border-strong bg-card px-4 py-2 text-sm font-medium text-ink"
            >
              {item}
            </span>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/docs/getting-started/installation"
            className="inline-flex w-full items-center justify-center rounded-full bg-ink px-8 py-3.5 text-sm font-semibold text-wash shadow-soft transition-colors hover:bg-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
          >
            {t("ctaSiteDocs")}
          </Link>
          <a
            href={branding.links.github}
            className="inline-flex w-full items-center justify-center rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-accent-fg shadow-soft transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("ctaGithub")}
          </a>
          <a
            href={`${branding.links.github}#readme`}
            className="inline-flex w-full items-center justify-center rounded-full border border-border-strong bg-card px-8 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("ctaDocs")}
          </a>
        </div>
        <div className="mx-auto mt-10 max-w-xl text-left">
          <CodeCopyBlock
            code={branding.installCommand}
            label="Install"
            minHeightClassName="min-h-[4.75rem]"
          />
        </div>
      </div>
    </section>
  );
}
