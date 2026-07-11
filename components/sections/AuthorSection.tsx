import {
  SITE_LAST_UPDATED_DISPLAY,
  SITE_LAST_UPDATED_ISO,
} from "@/config/content-freshness";

const AUTHOR_PROFILE = "https://github.com/rakeshcheekatimala";

export function AuthorSection() {
  return (
    <section className="border-b border-border bg-paper">
      <div className="safe-pad mx-auto max-w-content py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-px overflow-hidden border border-border bg-border sm:flex-row sm:items-stretch sm:justify-between">
          <div className="min-w-0">
            <div className="h-full bg-card p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                Author
              </p>
              <p className="mt-2 text-sm leading-7 text-ink">
              <a
                href={AUTHOR_PROFILE}
                rel="author"
                className="font-medium text-ink underline-offset-2 hover:underline"
              >
                Rakesh Cheekatimala
              </a>
              {" "}
              builds AnswerLint, an AI-visibility linting system for modern content teams.
              </p>
            </div>
          </div>
          <div className="bg-card px-4 py-3 sm:min-w-56 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
              npm package updated
            </p>
            <time
              dateTime={SITE_LAST_UPDATED_ISO}
              className="mt-2 block text-sm font-medium text-ink"
            >
              {SITE_LAST_UPDATED_DISPLAY}
            </time>
          </div>
        </div>
      </div>
    </section>
  );
}
