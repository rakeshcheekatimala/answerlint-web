import crypto from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";
import { createClaimToken, hashClaimToken } from "@/lib/reports/tokens";
import type {
  BusinessScanProject,
  BusinessScanRun,
} from "@/lib/business-scan/types";

export class ProjectAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectAccessError";
  }
}

/** Constant-time comparison of a presented token against a stored hash. */
export function tokenMatchesHash(
  token: string | undefined,
  storedHash: string | null | undefined,
): boolean {
  if (!storedHash) {
    // Legacy rows created before ownership tokens existed have no hash.
    // Deny mutation/reads that require ownership rather than allowing anyone.
    return false;
  }
  if (!token) return false;

  const presented = Buffer.from(hashClaimToken(token));
  const stored = Buffer.from(storedHash);
  if (presented.length !== stored.length) return false;
  return crypto.timingSafeEqual(presented, stored);
}

type BusinessScanProjectRow = {
  id: string;
  base_url: string;
  discovered_urls: string[];
  pages: BusinessScanProject["pages"];
  business_model: string;
  scan_history: BusinessScanRun[];
  latest_score: number | null;
  potential_score: number | null;
  lost_opportunity_score: number | null;
  created_at: string;
  updated_at: string;
  owner_token_hash?: string | null;
};

export async function storeBusinessScanProjectBestEffort(
  project: BusinessScanProject,
): Promise<BusinessScanProject> {
  if (!isSupabaseAdminConfigured()) {
    return { ...project, storageStatus: "skipped" };
  }

  try {
    const editToken = createClaimToken();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("business_scan_projects")
      .insert({ ...toProjectInsert(project), owner_token_hash: hashClaimToken(editToken) })
      .select(projectSelect)
      .single<BusinessScanProjectRow>();

    if (error || !data) {
      throw new Error(error?.message ?? "Unable to store Business-Aware Scan.");
    }

    return { ...fromProjectRow(data), storageStatus: "stored", editToken };
  } catch (error) {
    return {
      ...project,
      storageStatus: "failed",
      storageError: formatBusinessScanStorageError(error),
    };
  }
}

export async function updateBusinessScanProjectBestEffort(
  project: BusinessScanProject,
  editToken?: string,
): Promise<BusinessScanProject> {
  if (project.id.startsWith("local_") || !isSupabaseAdminConfigured()) {
    return { ...project, updatedAt: new Date().toISOString() };
  }

  // Ownership check: the caller must present the token that matches the stored
  // hash before we mutate a persisted project.
  await assertProjectOwnership(project.id, editToken);

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("business_scan_projects")
      .update(toProjectUpdate(project))
      .eq("id", project.id)
      .select(projectSelect)
      .single<BusinessScanProjectRow>();

    if (error || !data) {
      throw new Error(error?.message ?? "Unable to update Business-Aware Scan.");
    }

    return { ...fromProjectRow(data), storageStatus: "stored" };
  } catch (error) {
    if (error instanceof ProjectAccessError) throw error;
    return {
      ...project,
      storageStatus: "failed",
      storageError: formatBusinessScanStorageError(error),
    };
  }
}

export async function getBusinessScanProject(projectId: string, editToken?: string) {
  if (projectId.startsWith("local_") || !isSupabaseAdminConfigured()) {
    throw new Error("Business-Aware Scan project is not stored.");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("business_scan_projects")
    .select(projectSelectWithToken)
    .eq("id", projectId)
    .single<BusinessScanProjectRow>();

  if (error || !data) {
    throw new Error("Business-Aware Scan project not found.");
  }

  if (!tokenMatchesHash(editToken, data.owner_token_hash)) {
    throw new ProjectAccessError(
      "You do not have permission to open this project.",
    );
  }

  return { ...fromProjectRow(data), storageStatus: "stored" as const };
}

async function assertProjectOwnership(projectId: string, editToken?: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("business_scan_projects")
    .select("owner_token_hash")
    .eq("id", projectId)
    .single<{ owner_token_hash?: string | null }>();

  if (error || !data) {
    throw new ProjectAccessError("Business-Aware Scan project not found.");
  }

  if (!tokenMatchesHash(editToken, data.owner_token_hash)) {
    throw new ProjectAccessError(
      "You do not have permission to modify this project.",
    );
  }
}

function toProjectInsert(project: BusinessScanProject) {
  return {
    base_url: project.baseUrl,
    discovered_urls: project.discoveredUrls,
    pages: project.pages,
    business_model: project.businessModel,
    scan_history: project.scanHistory,
    latest_score: project.latestScore,
    potential_score: project.potentialScore,
    lost_opportunity_score: project.lostOpportunityScore,
    source: "business-aware-scan",
  };
}

function toProjectUpdate(project: BusinessScanProject) {
  return {
    discovered_urls: project.discoveredUrls,
    pages: project.pages,
    business_model: project.businessModel,
    scan_history: project.scanHistory,
    latest_score: project.latestScore,
    potential_score: project.potentialScore,
    lost_opportunity_score: project.lostOpportunityScore,
    updated_at: new Date().toISOString(),
  };
}

function fromProjectRow(row: BusinessScanProjectRow): BusinessScanProject {
  return {
    id: row.id,
    baseUrl: row.base_url,
    discoveredUrls: row.discovered_urls,
    pages: row.pages,
    businessModel: row.business_model,
    scanHistory: row.scan_history,
    latestScore: row.latest_score,
    potentialScore: row.potential_score,
    lostOpportunityScore: row.lost_opportunity_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    storageStatus: "stored",
  };
}

const projectSelect =
  "id,base_url,discovered_urls,pages,business_model,scan_history,latest_score,potential_score,lost_opportunity_score,created_at,updated_at";

const projectSelectWithToken = `${projectSelect},owner_token_hash`;

export function formatBusinessScanStorageError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Unable to store Business-Aware Scan.";

  if (
    message.includes("business_scan_projects") &&
    message.includes("schema cache")
  ) {
    return "Business-Aware Scan storage is not installed yet. Run supabase/business-scan-projects.sql in the Supabase SQL editor, then retry the scan.";
  }

  return message;
}
