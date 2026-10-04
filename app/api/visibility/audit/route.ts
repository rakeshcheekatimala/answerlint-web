import { NextResponse } from "next/server";

import { checkRateLimit, getClientKey } from "@/lib/net/rate-limit";
import { InvalidSiteAuditError, parseVisibilityAuditRequest } from "@/lib/visibility/audit-request";
import { isVisibilityEnabled } from "@/lib/visibility/feature-flag";
import { runAudit, type AuditEvent } from "@/lib/visibility/run-report";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isVisibilityEnabled()) {
    return NextResponse.json({ error: "AI visibility is not enabled." }, { status: 404 });
  }

  const rate = checkRateLimit(getClientKey(request, "visibility:audit"), {
    limit: 8,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many reports. Wait a moment and try again." },
      { status: 429, headers: { "retry-after": String(Math.ceil(rate.retryAfterMs / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send the report setup as JSON." }, { status: 400 });
  }

  let input;
  try {
    input = parseVisibilityAuditRequest(body);
  } catch (error) {
    if (error instanceof InvalidSiteAuditError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "The report could not be built." }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AuditEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await runAudit(input, send);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The report could not be built.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
