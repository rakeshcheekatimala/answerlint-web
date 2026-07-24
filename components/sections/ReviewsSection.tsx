import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getPublicReviews } from "@/lib/reviews/storage";
import { featureLabels } from "@/lib/reviews/types";

type Props = {
  locale: string;
};

export async function ReviewsSection({ locale }: Props) {
  const t = await getTranslations("Reviews");
  const items = await getPublicReviews(locale);

  return (
    <section
      id="reviews"
      className="scroll-mt-24 border-b border-border bg-paper-muted py-20 sm:py-24"
    >
      <div className="mx-auto max-w-content px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-ink-muted">{t("subtitle")}</p>

        {items.length === 0 ? (
          <div className="mt-12 border border-dashed border-border-strong bg-card/80 px-6 py-12 text-center sm:px-8">
            <p className="font-display text-xl font-semibold text-ink">
              {t("emptyTitle")}
            </p>
            <p className="mx-auto mt-4 max-w-lg text-ink-muted">{t("emptyBody")}</p>
            <Link
              href="/reviews/new"
              className="mt-7 inline-flex min-h-11 items-center justify-center bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t("share")}
            </Link>
          </div>
        ) : (
          <>
          <ul className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((review) => (
              <li
                key={review.id}
                className="flex min-h-64 flex-col border border-border bg-card p-6 shadow-soft"
              >
                <blockquote className="flex-1 text-base leading-relaxed text-ink">
                  “{review.quote}”
                </blockquote>
                <div className="mt-6 flex flex-wrap gap-x-2 gap-y-1 border-t border-border pt-4 text-xs font-medium text-ink-muted">
                  {review.featuresTried.slice(0, 2).map((feature) => (
                    <span key={feature}>{featureLabels[feature]}</span>
                  ))}
                  {review.featuresTried.length > 2 ? (
                    <span>+{review.featuresTried.length - 2} more</span>
                  ) : null}
                </div>
                <footer className="mt-4 text-sm text-ink-muted">
                  <span className="font-semibold text-ink">
                    {review.author.displayName}
                  </span>
                  {review.author.role || review.author.company ? (
                    <span className="block text-xs text-ink-subtle">
                      {[review.author.role, review.author.company].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                  {review.author.isVerifiedUser ? (
                    <span className="mt-2 inline-flex border border-border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      {t("verified")}
                    </span>
                  ) : null}
                </footer>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Link
              href="/reviews/new"
              className="inline-flex min-h-11 items-center justify-center border border-ink bg-transparent px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t("share")}
            </Link>
          </div>
          </>
        )}
      </div>
    </section>
  );
}
