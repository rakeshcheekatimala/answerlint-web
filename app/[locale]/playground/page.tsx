import { StructuredData } from "@/components/StructuredData";
import { SITE_URL } from "@/config/site-url";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { PlaygroundClient } from "@/components/playground/PlaygroundClient";

export default async function PlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<{ siteUrl?: string }>;
}) {
  const { siteUrl } = await searchParams;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "CiteOps Playground",
      url: `${SITE_URL}/playground`,
      description:
        "Interactive AEO and GEO audit playground with progressive report unlocks.",
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
          name: "Playground",
          item: `${SITE_URL}/playground`,
        },
      ],
    },
  ];

  return (
    <>
      <StructuredData data={structuredData} />
      <SiteHeader />
      <main
        id="main-content"
        className="min-h-screen bg-gradient-to-b from-wash via-paper to-paper-muted"
      >
        <PlaygroundClient initialUrl={siteUrl ?? ""} />
      </main>
      <SiteFooter />
    </>
  );
}
