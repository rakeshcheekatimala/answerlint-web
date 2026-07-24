import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ReviewForm } from "@/components/reviews/ReviewForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Share your AnswerLint experience",
  description: "Tell us which AnswerLint features you tried and what you learned.",
  robots: { index: false, follow: true },
};

export default async function NewReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("ReviewForm");

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="min-h-screen bg-paper">
        <section className="safe-pad border-b border-border bg-paper-muted py-14 sm:py-20">
          <div className="mx-auto max-w-2xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
              {t("eyebrow")}
            </p>
            <h1 className="mt-4 text-balance font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">
              {t("subtitle")}
            </p>
          </div>
        </section>
        <section className="safe-pad py-10 sm:py-14">
          <div className="mx-auto max-w-2xl">
            <ReviewForm locale={locale} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
