import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StructuredData } from "@/components/StructuredData";
import { SiteAuditClient } from "@/components/visibility/SiteAuditClient";
import { SITE_URL } from "@/config/site-url";
import { isVisibilityEnabled } from "@/lib/visibility/feature-flag";

export default async function AiVisibilityPage() {
  if (!isVisibilityEnabled()) notFound();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "AnswerLint AI Visibility (beta)",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}/tools/ai-visibility`,
    description:
      "A one-page report: citation share versus competitors, buyer questions the brand is missing, a technical check of the public page, and up to five fixes.",
  };

  return (
    <>
      <StructuredData data={structuredData} />
      <SiteHeader />
      <div className="min-h-screen bg-gradient-to-b from-wash via-paper to-paper-muted">
        <SiteAuditClient />
      </div>
      <SiteFooter />
    </>
  );
}
