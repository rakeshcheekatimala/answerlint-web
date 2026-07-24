import { NextResponse } from "next/server";

import { generateLlmsFiles } from "@/lib/llms/generate";
import { checkRateLimit, getClientKey } from "@/lib/net/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const rate = checkRateLimit(getClientKey(request, "llms:generate"), {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Generation limit reached. Please wait before trying again." },
      {
        status: 429,
        headers: { "retry-after": String(Math.ceil(rate.retryAfterMs / 1000)) },
      },
    );
  }

  try {
    const body = (await request.json()) as {
      url?: string;
      publicSite?: string;
      siteName?: string;
      summary?: string;
      includeFull?: boolean;
    };
    if (!body.url?.trim()) {
      return NextResponse.json({ error: "A public website URL is required." }, { status: 400 });
    }

    const result = await generateLlmsFiles({
      url: body.url.trim(),
      publicSite: body.publicSite?.trim() || undefined,
      siteName: body.siteName?.trim() || undefined,
      summary: body.summary?.trim() || undefined,
      includeFull: body.includeFull,
      maxLinks: 20,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate llms.txt.",
      },
      { status: 400 },
    );
  }
}
