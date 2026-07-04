import { StructuredData } from "@/components/StructuredData";
import { PlaygroundClient } from "@/components/playground/PlaygroundClient";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SITE_URL } from "@/config/site-url";

export default async function GeoAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ siteUrl?: string }>;
}) {
  const { siteUrl } = await searchParams;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "AI Visibility Score",
    url: `${SITE_URL}/tools/geo-audit`,
    description:
      "Run an AI visibility audit preview, then unlock the full report with progressive email capture.",
  };

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
