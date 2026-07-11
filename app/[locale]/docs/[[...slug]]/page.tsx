import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StructuredData } from "@/components/StructuredData";
import { DocsShell } from "@/components/docs/DocsShell";
import { SITE_URL } from "@/config/site-url";
import { defaultDocsSlug, docsGroups, getDocsPage } from "@/lib/docs";

type Props = {
  params: Promise<{ locale: string; slug?: string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocsPage(slug);

  if (!page) {
    return {};
  }

  const canonicalPath = `/docs/${(slug && slug.length > 0 ? slug : defaultDocsSlug).join("/")}`;

  return {
    title: `${page.title} · AnswerLint Docs`,
    description: page.description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: `${page.title} · AnswerLint Docs`,
      description: page.description,
      url: canonicalPath,
      type: "article",
      siteName: "AnswerLint",
    },
    twitter: {
      card: "summary_large_image",
      title: `${page.title} · AnswerLint Docs`,
      description: page.description,
    },
  };
}

export default async function DocsPage({ params }: Props) {
  const { locale, slug } = await params;
  const page = getDocsPage(slug);

  if (!page) {
    notFound();
  }

  const canonicalPath = `/docs/${(slug && slug.length > 0 ? slug : defaultDocsSlug).join("/")}`;
  const baseUrl = SITE_URL;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: page.title,
      description: page.description,
      url: `${baseUrl}${locale === "en" ? canonicalPath : `/${locale}${canonicalPath}`}`,
      author: {
        "@type": "Organization",
        name: "AnswerLint",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Docs",
          item: `${baseUrl}/docs/${defaultDocsSlug.join("/")}`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: page.title,
          item: `${baseUrl}${canonicalPath}`,
        },
      ],
    },
  ];

  return (
    <>
      <StructuredData data={structuredData} />
      <SiteHeader />
      <main id="main-content" className="bg-gradient-to-b from-wash to-paper">
        <DocsShell groups={docsGroups} page={page} />
      </main>
      <SiteFooter />
    </>
  );
}
