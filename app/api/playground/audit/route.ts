import { NextResponse } from "next/server";

import { getReportAccessConfig } from "@/lib/reports/access";
import { auditUrl, createDownloads } from "@/lib/siteops/audit";
import { createSingleReportPreview } from "@/lib/reports/preview";
import { storeAuditReportBestEffort } from "@/lib/reports/storage";
import type { GatedReportResponse } from "@/lib/reports/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    if (!body.url?.trim()) {
      return NextResponse.json({ error: "A URL is required." }, { status: 400 });
    }

    const report = await auditUrl(body.url);
    const downloads = createDownloads(report);
    const preview = createSingleReportPreview(report);
    const storedReport = await storeAuditReportBestEffort({
      kind: "single",
      targetUrl: report.url,
      preview,
      report,
      downloads,
    });
    const payload: GatedReportResponse = {
      ...storedReport,
      preview,
      access: getReportAccessConfig(),
      report,
      downloads,
    };

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Audit failed." },
      { status: 500 },
    );
  }
}
