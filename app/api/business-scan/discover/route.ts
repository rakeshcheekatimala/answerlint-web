import { NextResponse } from "next/server";

import { discoverBusinessScanProject } from "@/lib/business-scan/discovery";
import { isBusinessScanEnabled } from "@/lib/business-scan/feature-flag";
import { storeBusinessScanProjectBestEffort } from "@/lib/business-scan/storage";
import { checkRateLimit, getClientKey } from "@/lib/net/rate-limit";
import type { DiscoveryProgressEvent } from "@/lib/business-scan/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isBusinessScanEnabled()) {
    return NextResponse.json(
      { error: "Business-Aware Scan is not enabled." },
      { status: 404 },
    );
  }

  const rate = checkRateLimit(getClientKey(request, "business-scan:discover"), {
    limit: 6,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many discovery requests. Please wait a moment and try again." },
      {
        status: 429,
        headers: { "retry-after": String(Math.ceil(rate.retryAfterMs / 1000)) },
      },
    );
  }

  let body: { baseUrl?: string };
  try {
    body = (await request.json()) as { baseUrl?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.baseUrl?.trim()) {
    return NextResponse.json({ error: "A base URL is required." }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: DiscoveryProgressEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        const project = await discoverBusinessScanProject(body.baseUrl ?? "", {
          onProgress: send,
        });
        const storedProject = await storeBusinessScanProjectBestEffort(project);
        send({ type: "project", project: storedProject });
      } catch (error) {
        send({
          type: "error",
          error:
            error instanceof Error
              ? error.message
              : "Unable to discover this website.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
