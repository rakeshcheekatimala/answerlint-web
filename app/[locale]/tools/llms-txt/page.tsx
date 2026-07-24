import type { Metadata } from "next";
import type { ReactNode } from "react";

import { LlmsGeneratorClient } from "@/components/llms/LlmsGeneratorClient";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StructuredData } from "@/components/StructuredData";
import { SITE_URL } from "@/config/site-url";

export const metadata: Metadata = {
  title: "Free llms.txt Generator — AnswerLint",
  description:
    "Generate and download deterministic llms.txt and llms-full.txt roadmaps from a public website.",
  alternates: { canonical: "/tools/llms-txt" },
};

export default function LlmsTxtPage() {
  return (
    <>
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "AnswerLint llms.txt Generator",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web",
          url: `${SITE_URL}/tools/llms-txt`,
          description:
            "Generate deterministic llms.txt and llms-full.txt roadmaps from a public website.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />
      <SiteHeader />
      <main id="main-content" className="min-h-screen bg-paper">
        <section className="safe-pad border-b border-border bg-paper-muted py-14 sm:py-20">
          <div className="mx-auto max-w-content">
            <div className="max-w-3xl">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                Free developer tool
              </p>
              <h1 className="mt-4 text-balance font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
                Generate a clean AI roadmap for your site.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">
                Discover public content, produce a valid llms.txt, inspect every link,
                and download files ready for your site root. No model key required.
              </p>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-ink-muted">
                <span>Sitemap-first discovery</span>
                <span>Production URL override</span>
                <span>Deterministic output</span>
              </div>
            </div>
          </div>
        </section>

        <section className="safe-pad py-10 sm:py-14">
          <div className="mx-auto max-w-content">
            <LlmsGeneratorClient />
          </div>
        </section>

        <section className="safe-pad border-t border-border bg-paper-muted py-12">
          <div className="mx-auto grid max-w-content gap-8 md:grid-cols-3">
            <Info title="Where to publish">
              Add llms.txt and, optionally, llms-full.txt at the root of your public
              site so they resolve as /llms.txt and /llms-full.txt.
            </Info>
            <Info title="What gets extracted">
              Titles, descriptions, headings, page text, sitemap URLs, and same-site
              links. Output stays reproducible and reviewable.
            </Info>
            <Info title="Use it in CI">
              Generate locally with the AnswerLint CLI, then lint the committed file
              with strict CI checks before deployment.
            </Info>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Info({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{children}</p>
    </article>
  );
}
