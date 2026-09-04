import crypto from "node:crypto";

import type { VisibilityEvidence } from "@/lib/visibility/reporting";
import type { VisibilityProject } from "@/lib/visibility/types";
import { assertVisibilityCrewConfigured, visibilityCrewConfig } from "@/lib/visibility/crew/config";
import { parseVisibilityCrewAnalysis } from "@/lib/visibility/crew/schema";
import type { VisibilityCrewAnalysis } from "@/lib/visibility/crew/types";

export async function invokeVisibilityCrew(
  project: VisibilityProject,
  evidence: VisibilityEvidence,
): Promise<VisibilityCrewAnalysis | null> {
  const config = visibilityCrewConfig();
  if (config.mode === "disabled") return null;

  try {
    assertVisibilityCrewConfigured(config);
    const crewRequest = buildCrewRequest(project, evidence);
    const body = JSON.stringify(crewRequest);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const requestId = crewRequest.analysis_id;
    const signature = createCrewSignature(config.signingSecret as string, timestamp, requestId, body);
    const response = await fetch(`${config.url}/v1/analyze`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-answerlint-key-id": config.keyId,
        "x-answerlint-timestamp": timestamp,
        "x-answerlint-request-id": requestId,
        "x-answerlint-signature": signature,
      },
      body,
      signal: AbortSignal.timeout(config.timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Visibility Crew returned HTTP ${response.status}.`);
    }
    return parseVisibilityCrewAnalysis(await response.json());
  } catch (error) {
    if (config.mode === "required") throw error;
    return null;
  }
}

export function createCrewSignature(secret: string, timestamp: string, requestId: string, body: string) {
  return `v1=${crypto.createHmac("sha256", secret).update(`${timestamp}.${requestId}.${body}`).digest("hex")}`;
}

function buildCrewRequest(project: VisibilityProject, evidence: VisibilityEvidence) {
  const sortedRunIds = evidence.runs.map((run) => run.runId).sort().join(":");
  const digest = crypto
    .createHash("sha256")
    .update(`${project.id}:1:${sortedRunIds}`)
    .digest("hex")
    .slice(0, 32);
  const topics = new Map(project.topics.map((topic) => [topic.id, topic]));
  const prompts = new Map(project.prompts.map((prompt) => [prompt.id, prompt]));
  return {
    analysis_id: `analysis-${digest}`,
    project_id: project.id,
    cohort_version: 1,
    brand_name: project.intake.brandName,
    brand_url: project.intake.brandUrl,
    category: project.intake.primaryCategory,
    target_customers: project.intake.targetCustomers,
    intended_brand_voice: project.brandCard.valueProposition,
    approved_claims: project.brandCard.claims,
    buyer_jobs: project.intake.keyUseCases,
    owned_pages: project.brandCard.initialOwnedAssets.map((asset) => ({
      url: asset.url,
      reason: asset.reason,
      page_role: "unknown",
    })),
    runs: evidence.runs.slice(0, 60).map((run) => ({
      run_id: run.runId,
      prompt_id: run.promptId,
      prompt: prompts.get(run.promptId)?.text ?? "Unknown approved prompt",
      buyer_job: topics.get(run.topicId)?.statement ?? "Unknown buyer job",
      market: run.market,
      answer_excerpt: (run.answerExcerpt ?? "No retained answer excerpt").slice(0, 4_000),
      brand_mentioned: run.observation.brandMentioned,
      recommendation_strength: run.observation.recommendationStrength,
      citations: run.citations.slice(0, 12).map((citation) => ({
        url: citation.canonicalUrl ?? citation.url,
        source_type: citation.sourceType,
        resolved: citation.resolved,
        verification_status: citation.verificationStatus ?? (citation.resolved ? "citation_resolved" : "unresolved"),
        excerpt: citation.excerpt?.slice(0, 2_000) ?? null,
      })),
    })),
  };
}
