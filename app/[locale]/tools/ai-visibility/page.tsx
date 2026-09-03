import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StructuredData } from "@/components/StructuredData";
import { VisibilityWorkspaceClient } from "@/components/visibility/VisibilityWorkspaceClient";
import { SITE_URL } from "@/config/site-url";
import { isVisibilityEnabled } from "@/lib/visibility/feature-flag";

export default async function AiVisibilityPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  if (!isVisibilityEnabled()) notFound();
  const { projectId } = await searchParams;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "AnswerLint AI Visibility (beta)",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}/tools/ai-visibility`,
    description:
      "Plan and verify controlled OpenAI web-search answer evidence with approvals, recorded run policy, citations, and defensible actions.",
  };

  return (
    <>
      <StructuredData data={structuredData} />
      <SiteHeader />
      <div className="min-h-screen bg-gradient-to-b from-wash via-paper to-paper-muted">
        <VisibilityWorkspaceClient initialProjectId={projectId} />
      </div>
      <SiteFooter />
    </>
  );
}
