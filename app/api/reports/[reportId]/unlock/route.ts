import { NextResponse } from "next/server";

import { markReportUnlockIntent } from "@/lib/reports/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getRequestOrigin(request: Request) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    new URL(request.url).origin
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const { reportId } = await params;
    const body = (await request.json()) as {
      email?: string;
      claimToken?: string;
    };

    if (!body.email?.trim()) {
      return NextResponse.json(
        { error: "A work email is required." },
        { status: 400 },
      );
    }

    if (!body.claimToken?.trim()) {
      return NextResponse.json(
        { error: "This report session is missing its secure token." },
        { status: 400 },
      );
    }

    const email = body.email.trim().toLowerCase();
    await markReportUnlockIntent({
      reportId,
      claimToken: body.claimToken,
      email,
    });

    const origin = getRequestOrigin(request);
    const reportPath = `/tools/geo-audit/report?id=${encodeURIComponent(
      reportId,
    )}&token=${encodeURIComponent(body.claimToken)}`;
    const emailRedirectTo = `${origin}/auth/confirm?next=${encodeURIComponent(
      reportPath,
    )}`;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        shouldCreateUser: true,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      message: "Check your inbox for a secure report link.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to send secure report link.",
      },
      { status: 500 },
    );
  }
}
