import { NextResponse } from "next/server";

import {
  canFailOpen,
  getReportAccessConfig,
  shouldSendMagicLink,
} from "@/lib/reports/access";
import {
  buildReportMagicLinkRedirect,
  getPublicSiteOrigin,
} from "@/lib/reports/redirects";
import {
  captureReportLead,
  markReportUnlockIntent,
} from "@/lib/reports/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

class ReportUnlockError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
  }
}

function getMagicLinkAuthFailure(message: string, redirectTo: string) {
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("redirect") ||
    normalizedMessage.includes("not allowed")
  ) {
    return {
      message: `Supabase rejected the magic-link redirect. Add this callback to Supabase Auth redirect URLs: ${redirectTo}`,
      status: 502,
    };
  }

  if (
    normalizedMessage.includes("rate limit") ||
    normalizedMessage.includes("too many")
  ) {
    return {
      message:
        "Email rate limit exceeded. Please wait about 60 seconds before requesting another secure report link.",
      status: 429,
    };
  }

  if (
    normalizedMessage.includes("email") ||
    normalizedMessage.includes("smtp") ||
    normalizedMessage.includes("rate limit")
  ) {
    return {
      message: `Supabase could not send the magic-link email: ${message}`,
      status: 502,
    };
  }

  return {
    message: `Supabase could not create the magic link: ${message}`,
    status: 502,
  };
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
    const accessConfig = getReportAccessConfig();

    if (!shouldSendMagicLink(accessConfig)) {
      try {
        const capture = await captureReportLead({
          reportId,
          claimToken: body.claimToken,
          email,
        });

        return NextResponse.json({
          ok: true,
          captured: capture.captured,
          message: capture.captured
            ? "Report unlocked. You can download it now."
            : "Report unlocked. Download is ready.",
        });
      } catch (captureError) {
        if (!canFailOpen(accessConfig)) {
          throw captureError;
        }

        return NextResponse.json({
          ok: true,
          captured: false,
          message: "Report unlocked. Download is ready.",
        });
      }
    }

    await markReportUnlockIntent({
      reportId,
      claimToken: body.claimToken,
      email,
    });

    const emailRedirectTo = buildReportMagicLinkRedirect({
      origin: getPublicSiteOrigin(request),
      reportId,
      claimToken: body.claimToken,
    });

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        shouldCreateUser: true,
      },
    });

    if (error) {
      const authFailure = getMagicLinkAuthFailure(error.message, emailRedirectTo);
      throw new ReportUnlockError(authFailure.message, authFailure.status);
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
      { status: error instanceof ReportUnlockError ? error.status : 500 },
    );
  }
}
