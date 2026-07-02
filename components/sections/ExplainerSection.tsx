import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { branding } from "@/config/branding";

export async function ExplainerSection() {
  const t = await getTranslations("Explainer");

  return (
    <section className="border-b border-border bg-paper py-14 sm:py-20">
      <div className="safe-pad mx-auto max-w-content sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            {t("eyebrow")}
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
            {t("title")}
          </h2>
         
        </div>

        <div className="mt-10 border border-border bg-card p-3 shadow-soft sm:p-4">
          <div className="overflow-hidden border border-border bg-paper-muted">
            <a
              href={branding.explainerImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
              aria-label={t("openImage")}
            >
              <Image
                src={branding.explainerImageUrl}
                alt={t("imageAlt")}
                width={1440}
                height={1600}
                priority={false}
                className="h-auto w-full object-contain"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 72rem"
              />
            </a>
          </div>
        </div>


        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href={branding.explainerImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-full border border-border-strong bg-card px-6 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent sm:w-auto"
          >
            {t("openImage")}
          </a>
          <Link
            href="/playground"
            className="inline-flex w-full items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-wash transition hover:bg-ink-muted sm:w-auto"
          >
            {t("cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
