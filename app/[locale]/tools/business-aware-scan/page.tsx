import { notFound } from "next/navigation";

import { BusinessAwareScanClient } from "@/components/business-scan/BusinessAwareScanClient";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StructuredData } from "@/components/StructuredData";
import { SITE_URL } from "@/config/site-url";
import { isBusinessScanEnabled } from "@/lib/business-scan/feature-flag";

export default async function BusinessAwareScanPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; siteUrl?: string }>;
}) {
  if (!isBusinessScanEnabled()) {
    notFound();
  }

  const { projectId, siteUrl } = await searchParams;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Business-Aware Scan",
      url: `${SITE_URL}/tools/business-aware-scan`,
      description:
        "Map a website by business importance, review the pages AI should understand first, and calculate a Business Visibility Score.",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: `${SITE_URL}/`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Business-Aware Scan",
          item: `${SITE_URL}/tools/business-aware-scan`,
        },
      ],
    },
  ];

  return (
    <>
      <StructuredData data={structuredData} />
      <SiteHeader />
      <main className="min-h-screen bg-gradient-to-b from-wash via-paper to-paper-muted">
        <BusinessAwareScanClient
          initialBaseUrl={siteUrl}
          initialProjectId={projectId}
        />
      </main>
      <SiteFooter />
    </>
  );
}
