import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StructuredData } from "@/components/StructuredData";
import { VisibilityWorkspaceClient } from "@/components/visibility/VisibilityWorkspaceClient";
import { SITE_URL } from "@/config/site-url";

export default async function AiVisibilityPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "AnswerLint AI Visibility",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}/tools/ai-visibility`,
    description:
      "Plan and verify answer visibility across selected AI surfaces with human approvals, run manifests, citation evidence, and defensible actions.",
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
