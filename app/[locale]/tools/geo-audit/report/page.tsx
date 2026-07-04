import { StructuredData } from "@/components/StructuredData";
import { UnlockedReportClient } from "@/components/reports/UnlockedReportClient";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SITE_URL } from "@/config/site-url";

export default async function GeoAuditReportPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; token?: string }>;
}) {
  const { id, token } = await searchParams;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Saved AI Visibility Report",
    url: `${SITE_URL}/tools/geo-audit/report`,
    description: "Secure saved AI visibility audit report.",
  };

  return (
    <>
      <StructuredData data={structuredData} />
      <SiteHeader />
      <main
        id="main-content"
        className="min-h-screen bg-gradient-to-b from-wash via-paper to-paper-muted"
      >
        <div className="safe-pad mx-auto max-w-content py-12 sm:px-6 lg:px-8 lg:py-20">
          <UnlockedReportClient reportId={id ?? ""} claimToken={token ?? ""} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
