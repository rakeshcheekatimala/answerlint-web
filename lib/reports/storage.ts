import crypto from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getReportAccessConfig,
  type ReportStorageMode,
} from "@/lib/reports/access";
import {
  createClaimToken,
  formatSupabaseStorageError,
  hashClaimToken,
} from "@/lib/reports/tokens";
import type {
  AuditReportKind,
  AuditReportPreview,
  UnlockedReportResponse,
} from "@/lib/reports/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  SiteOpsComparisonReport,
  SiteOpsDownloads,
  SiteOpsReport,
} from "@/lib/siteops/types";

type StoredReportRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  kind: AuditReportKind;
  target_url: string;
  competitor_url: string | null;
  preview: AuditReportPreview;
  report: SiteOpsReport | SiteOpsComparisonReport;
  downloads: SiteOpsDownloads;
  claim_token_hash: string;
  created_at: string;
  unlocked_at: string | null;
};

export type StoreAuditReportResult = {
  reportId: string;
  claimToken: string;
  storageStatus: "stored" | "skipped" | "failed";
  storageError?: string;
};

function createLocalReportHandle(
  storageStatus: StoreAuditReportResult["storageStatus"] = "skipped",
): StoreAuditReportResult {
  return {
    reportId: `local_${crypto.randomUUID()}`,
    claimToken: createClaimToken(),
    storageStatus,
  };
}

function shouldSkipStorage(storageMode: ReportStorageMode) {
  return storageMode === "disabled";
}

export async function storeAuditReport({
  kind,
  targetUrl,
  competitorUrl = null,
  preview,
  report,
  downloads,
  source = "playground",
}: {
  kind: AuditReportKind;
  targetUrl: string;
  competitorUrl?: string | null;
  preview: AuditReportPreview;
  report: SiteOpsReport | SiteOpsComparisonReport;
  downloads: SiteOpsDownloads;
  source?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const claimToken = createClaimToken();

  const { data, error } = await supabase
    .from("audit_reports")
    .insert({
      kind,
      target_url: targetUrl,
      competitor_url: competitorUrl,
      preview,
      report,
      downloads,
      claim_token_hash: hashClaimToken(claimToken),
      source,
      status: "completed",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `Unable to store audit report: ${formatSupabaseStorageError(
        error.message,
      )}`,
    );
  }

  await recordAuditEvent(data.id, "report_created", {
    kind,
    targetUrl,
    competitorUrl,
    source,
  });

  return {
    reportId: data.id as string,
    claimToken,
    storageStatus: "stored" as const,
  };
}

export async function storeAuditReportBestEffort(
  input: Parameters<typeof storeAuditReport>[0],
): Promise<StoreAuditReportResult> {
  const config = getReportAccessConfig();

  if (shouldSkipStorage(config.storageMode)) {
    return createLocalReportHandle();
  }

  try {
    return await storeAuditReport(input);
  } catch (error) {
    if (config.storageMode === "required") {
      throw error;
    }

    return {
      ...createLocalReportHandle("failed"),
      storageError:
        error instanceof Error ? error.message : "Unable to store report.",
    };
  }
}

export async function recordAuditEvent(
  reportId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("audit_events").insert({
      report_id: reportId,
      event_type: eventType,
      metadata,
    });
  } catch {
    // Analytics should never block the user journey.
  }
}

export async function captureReportLead({
  reportId,
  claimToken,
  email,
}: {
  reportId: string;
  claimToken: string;
  email: string;
}) {
  if (reportId.startsWith("local_")) {
    return {
      captured: false,
      reason: "Report was generated without persistent storage.",
    };
  }

  await markReportUnlockIntent({
    reportId,
    claimToken,
    email,
    eventType: "email_captured",
  });

  return { captured: true };
}

export async function markReportUnlockIntent({
  reportId,
  claimToken,
  email,
  eventType = "magic_link_requested",
}: {
  reportId: string;
  claimToken: string;
  email: string;
  eventType?: string;
}) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("audit_reports")
    .select("id, claim_token_hash")
    .eq("id", reportId)
    .single();

  if (error || !data) {
    throw new Error("Report not found.");
  }

  if (data.claim_token_hash !== hashClaimToken(claimToken)) {
    throw new Error("This report link is no longer valid.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { error: updateError } = await supabase
    .from("audit_reports")
    .update({
      email: normalizedEmail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (updateError) {
    throw new Error(`Unable to save email: ${updateError.message}`);
  }

  await recordAuditEvent(reportId, eventType, {
    email: normalizedEmail,
  });
}

export async function getUnlockedReport({
  reportId,
  claimToken,
}: {
  reportId: string;
  claimToken?: string | null;
}): Promise<UnlockedReportResponse> {
  const serverSupabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await serverSupabase.auth.getUser();

  if (userError || !user?.email) {
    throw new Error("AUTH_REQUIRED");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audit_reports")
    .select(
      "id,user_id,email,kind,target_url,competitor_url,preview,report,downloads,claim_token_hash,created_at,unlocked_at",
    )
    .eq("id", reportId)
    .single<StoredReportRow>();

  if (error || !data) {
    throw new Error("REPORT_NOT_FOUND");
  }

  const emailMatches =
    data.email?.toLowerCase() === user.email.toLowerCase();
  const tokenMatches =
    Boolean(claimToken) &&
    data.claim_token_hash === hashClaimToken(String(claimToken));
  const ownedByUser = data.user_id === user.id;

  if (data.user_id && !ownedByUser) {
    throw new Error("REPORT_FORBIDDEN");
  }

  if (!ownedByUser && !emailMatches && !tokenMatches) {
    throw new Error("REPORT_FORBIDDEN");
  }

  if (!ownedByUser) {
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("audit_reports")
      .update({
        user_id: user.id,
        email: user.email.toLowerCase(),
        unlocked_at: data.unlocked_at ?? now,
        last_viewed_at: now,
        updated_at: now,
      })
      .eq("id", reportId);

    if (updateError) {
      throw new Error(`Unable to claim report: ${updateError.message}`);
    }

    await recordAuditEvent(reportId, "report_unlocked", {
      email: user.email.toLowerCase(),
      userId: user.id,
    });
  } else {
    await supabase
      .from("audit_reports")
      .update({
        last_viewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);
  }

  return {
    id: data.id,
    kind: data.kind,
    email: user.email.toLowerCase(),
    targetUrl: data.target_url,
    competitorUrl: data.competitor_url,
    createdAt: data.created_at,
    unlockedAt: data.unlocked_at,
    report: data.report,
    downloads: data.downloads,
  };
}
