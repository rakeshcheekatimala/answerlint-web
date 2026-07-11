import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StructuredData } from "@/components/StructuredData";
import { ActionSection } from "@/components/sections/ActionSection";
import { AuthorSection } from "@/components/sections/AuthorSection";
import { AudienceSection } from "@/components/sections/AudienceSection";
import { ComparisonSection } from "@/components/sections/ComparisonSection";
import { CompatibilitySection } from "@/components/sections/CompatibilitySection";
import { CtaSection } from "@/components/sections/CtaSection";
import { EducationSection } from "@/components/sections/EducationSection";
import { ExplainerSection } from "@/components/sections/ExplainerSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { Hero } from "@/components/sections/Hero";
import { HowSection } from "@/components/sections/HowSection";
import { ProductSection } from "@/components/sections/ProductSection";
import { ReportSection } from "@/components/sections/ReportSection";
import { ReviewsSection } from "@/components/sections/ReviewsSection";
import { StatsStrip } from "@/components/sections/StatsStrip";
import { WorkflowSection } from "@/components/sections/WorkflowSection";
import { WhySection } from "@/components/sections/WhySection";
import {
  SITE_LAST_UPDATED_ISO,
  SITE_PUBLISHED_ISO,
} from "@/config/content-freshness";
import { SITE_URL } from "@/config/site-url";

type Props = {
  params: Promise<{ locale: string }>;
};

const AUTHOR_PROFILE = "https://github.com/rakeshcheekatimala";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const baseUrl = SITE_URL;
  const canonical = locale === "en" ? baseUrl : `${baseUrl}/${locale}`;
  const publishedTime = `${SITE_PUBLISHED_ISO}T12:00:00.000Z`;
  const modifiedTime = `${SITE_LAST_UPDATED_ISO}T12:00:00.000Z`;

  return {
    title: t("title"),
    description: t("description"),
    authors: [{ name: "Rakesh Cheekatimala", url: AUTHOR_PROFILE }],
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: t("title"),
      description: t("description"),
      publishedTime,
      modifiedTime,
      siteName: "CiteOps",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
    other: {
      "article:published_time": publishedTime,
      "article:modified_time": modifiedTime,
    },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  const baseUrl = SITE_URL;
  const pageUrl = locale === "en" ? baseUrl : `${baseUrl}/${locale}`;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "CiteOps",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "macOS, Linux, Windows",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      url: pageUrl,
      description:
        "Open-source audit tooling and playground for Answer Engine Optimization and Generative Engine Optimization.",
      author: {
        "@type": "Person",
        name: "Rakesh Cheekatimala",
        url: AUTHOR_PROFILE,
        jobTitle: "Founder",
      },
      publisher: {
        "@type": "Organization",
        name: "CiteOps",
        url: baseUrl,
      },
      dateModified: SITE_LAST_UPDATED_ISO,
      datePublished: SITE_PUBLISHED_ISO,
      about: [
        { "@type": "Thing", "name": "Answer Engine Optimization" },
        { "@type": "Thing", "name": "Generative Engine Optimization" },
        { "@type": "Thing", "name": "AI visibility audits" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What does llm-citeops help content teams measure?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "llm-citeops measures how ready a page is to be quoted in AI answers and trusted in search using AEO, GEO, and composite scoring.",
          },
        },
        {
          "@type": "Question",
          name: "How does llm-citeops compare with manual reviews?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "llm-citeops gives content teams a repeatable checklist, structured scoring, and exportable reports instead of one-off subjective reviews.",
          },
        },
        {
          "@type": "Question",
          name: "Can developers use llm-citeops in CI?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Developers can run URL, file, directory, and sitemap audits, export JSON or CSV, and enforce thresholds in CI.",
          },
        },
        {
          "@type": "Question",
          name: "Why do AEO and GEO both matter for B2B teams?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AEO helps pages become direct answers, while GEO helps teams build the trust signals, citations, and authority needed to become cited sources.",
          },
        },
      ],
    },
  ];

  return (
    <>
      <StructuredData data={structuredData} />
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <WhySection />
        <AudienceSection />
        <StatsStrip />
        <ProductSection />
        <ReportSection />
        <ActionSection />
        <HowSection />
        <WorkflowSection />
        <ComparisonSection />
        <EducationSection />
        <ExplainerSection />
        <CompatibilitySection />
        <FaqSection />
        <ReviewsSection locale={locale} />
        <AuthorSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
