import { NextResponse } from "next/server";

import { getUnlockedReport } from "@/lib/reports/storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const { reportId } = await params;
    const url = new URL(request.url);
    const claimToken = url.searchParams.get("token");
    const report = await getUnlockedReport({ reportId, claimToken });

    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load report.";

    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { error: "Sign in with the same email to unlock this report." },
        { status: 401 },
      );
    }

    if (message === "REPORT_NOT_FOUND") {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    if (message === "REPORT_FORBIDDEN") {
      return NextResponse.json(
        { error: "This report belongs to another account." },
        { status: 403 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
