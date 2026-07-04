import { NextResponse } from "next/server";

import {
  compareUrls,
  createComparisonDownloads,
} from "@/lib/siteops/audit";
import { createComparisonReportPreview } from "@/lib/reports/preview";
import { storeAuditReport } from "@/lib/reports/storage";
import type { GatedReportResponse } from "@/lib/reports/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      url?: string;
      competitorUrl?: string;
    };

    if (!body.url?.trim()) {
      return NextResponse.json({ error: "A URL is required." }, { status: 400 });
    }

    if (!body.competitorUrl?.trim()) {
      return NextResponse.json(
        { error: "A competitor URL is required." },
        { status: 400 },
      );
    }

    const report = await compareUrls(body.url, body.competitorUrl);
    const downloads = createComparisonDownloads(report);
    const preview = createComparisonReportPreview(report);
    const storedReport = await storeAuditReport({
      kind: "comparison",
      targetUrl: report.target.url,
      competitorUrl: report.competitor.url,
      preview,
      report,
      downloads,
    });
    const payload: GatedReportResponse = {
      ...storedReport,
      preview,
    };

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Competitor comparison failed.",
      },
      { status: 500 },
    );
  }
}
