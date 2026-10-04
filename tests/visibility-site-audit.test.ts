import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimits } from "@/lib/net/rate-limit";
import { UnsafeUrlError } from "@/lib/net/url-guard";
import type { LeadershipReport } from "@/lib/visibility/leadership";
import { buildSiteAuditReport, readPageSignals, type PageProbe } from "@/lib/visibility/site-audit";

const safeFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/net/url-guard", async () => {
  const actual = await vi.importActual<typeof import("@/lib/net/url-guard")>("@/lib/net/url-guard");
  return { ...actual, safeFetch };
});

import { POST } from "@/app/api/visibility/audit/route";

const html = `<!doctype html><html><head>
<title>Example compliance</title>
<link rel="canonical" href="https://example.com/">
<meta name="description" content="Example helps security teams prepare for SOC 2 with a direct checklist.">
<meta name="author" content="Ada">
<script type="application/ld+json">{"@type":"FAQPage","name":"Example"}</script>
</head><body><h1>Prepare for SOC 2</h1><p>Example helps security teams prepare for SOC 2.</p></body></html>`;

const input = {
  brandName: "Example",
  brandUrl: "https://example.com",
  category: "compliance software",
  customer: "security teams",
  questions: ["How should security teams prepare for SOC 2?"],
  competitors: [{ name: "Rival", url: "https://rival.example" }],
};

function probe(partial: Partial<PageProbe> & Pick<PageProbe, "role" | "name" | "url">): PageProbe {
  return {
    opened: true,
    statusCode: 200,
    error: null,
    title: "Title",
    heading: "Heading",
    canonical: "https://example.com/",
    hasDirectAnswer: true,
    schemaTypes: ["FAQPage"],
    citationSignals: ["author"],
    ...partial,
  };
}

describe("site audit report", () => {
  it("reads public page signals and ignores broken schema", () => {
    const signals = readPageSignals(
      `${html}<script type="application/ld+json">{not json}</script>`,
    );
    expect(signals).toMatchObject({
      title: "Example compliance",
      heading: "Prepare for SOC 2",
      canonical: "https://example.com/",
      hasDirectAnswer: true,
      schemaTypes: ["FAQPage"],
      citationSignals: ["author", "article schema"],
    });
  });

  it("keeps a description that contains an apostrophe", () => {
    const signals = readPageSignals(
      `<!doctype html><html><head><title>Singtel: Mobile</title><meta name="description" content="The Singtel Group, Asia's leading communications group provides a diverse range of services including fixed, mobile, data, internet, TV."></head><body></body></html>`,
    );
    expect(signals.hasDirectAnswer).toBe(true);
    expect(signals.heading).toBeNull();
  });

  it("keeps citation share unmeasured and limits fixes to brand page gaps", () => {
    const report = buildSiteAuditReport(input, [
      probe({
        role: "brand",
        name: "Example",
        url: "https://example.com",
        title: null,
        heading: null,
        canonical: null,
        hasDirectAnswer: false,
        schemaTypes: [],
        citationSignals: [],
      }),
      probe({
        role: "competitor",
        name: "Rival",
        url: "https://rival.example",
        opened: false,
        statusCode: null,
        error: "The site could not be reached.",
        title: null,
        heading: null,
        canonical: null,
        hasDirectAnswer: false,
        schemaTypes: [],
        citationSignals: [],
      }),
    ]);

    expect(report.citationRows.map((row) => row.share)).toEqual([null, null]);
    expect(report.questions).toEqual([
      { text: input.questions[0], status: "not_scored" },
    ]);
    expect(report.fixes.map((fix) => fix.title)).toEqual([
      "Add a page title",
      "Add a heading",
      "Add a direct answer",
      "Add a canonical URL",
      "Add structured data",
    ]);
    expect(report.fixes).toHaveLength(5);
    expect(report.pages[1]?.checks[0]).toMatchObject({ status: "needs_work" });
    expect(report.pages[1]?.checks[1]).toMatchObject({ status: "waiting" });
    expect(JSON.stringify(report)).not.toMatch(/\d+%/);
  });

  it("does not turn a failed fetch into a passing check", () => {
    const report = buildSiteAuditReport(input, [
      probe({
        role: "brand",
        name: "Example",
        url: "https://example.com",
        opened: false,
        error: "The site returned 404.",
        title: null,
        heading: null,
        canonical: null,
        hasDirectAnswer: false,
        schemaTypes: [],
        citationSignals: [],
      }),
    ]);
    expect(report.fixes).toEqual([
      expect.objectContaining({ title: "Make the brand page open" }),
    ]);
    expect(report.pages[0]?.checks.some((check) => check.status === "pass")).toBe(false);
  });
});

describe("POST /api/visibility/audit", () => {
  beforeEach(() => {
    resetRateLimits();
    safeFetch.mockReset();
    process.env.NEXT_PUBLIC_ENABLE_AI_VISIBILITY = "true";
    delete process.env.OPENAI_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  });

  it("returns a report without a paid provider and does not pass a failed fetch", async () => {
    safeFetch.mockImplementation(async (url: string) => {
      if (String(url).includes("rival")) {
        throw new UnsafeUrlError("Host resolves to a non-public address and cannot be scanned.");
      }
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    });

    const response = await POST(
      jsonRequest({
        domain: "https://example.com",
        phase: "report",
        brandName: "Example",
        prompts: ["How should security teams prepare for SOC 2?"],
        competitors: [{ name: "Rival", url: "https://rival.example" }],
      }),
    );
    expect(response.status).toBe(200);
    const events = await readEvents(response);
    const report = events.find((event) => event.type === "report")?.report as LeadershipReport;
    expect(report.summary).toBe("ChatGPT needs an API key.");
    expect(report.citationRows[0].shares).toEqual([null]);
    expect(report.unscoredPrompts).toEqual(["How should security teams prepare for SOC 2?"]);
    expect(report.missingPrompts).toEqual([]);
    expect(report.pages[0].opened).toBe(true);
    expect(report.pages[0].checks.some((check: { status: string }) => check.status === "pass")).toBe(true);
    expect(report.pages[1].opened).toBe(false);
    expect(report.pages[1].error).toContain("non-public");
    expect(report.pages[1].checks.some((check: { status: string }) => check.status === "pass")).toBe(false);
    expect(JSON.stringify(report)).not.toMatch(/\d+%/);
    expect(events.some((event) => event.type === "status" && event.message === "ChatGPT needs an API key.")).toBe(
      true,
    );
  });

  it("returns 400 for invalid JSON and for a bad URL", async () => {
    const invalidJson = await POST(
      new Request("http://test/api/visibility/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(invalidJson.status).toBe(400);

    const badUrl = await POST(jsonRequest({ domain: "ftp://example.com", phase: "discover" }));
    expect(badUrl.status).toBe(400);
    expect(safeFetch).not.toHaveBeenCalled();
  });

  it("returns 404 when the feature is off", async () => {
    process.env.NEXT_PUBLIC_ENABLE_AI_VISIBILITY = "false";
    const response = await POST(jsonRequest({ domain: "https://example.com" }));
    expect(response.status).toBe(404);
  });
});

async function readEvents(response: Response) {
  const text = await response.text();
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { type: string; message?: string; report?: LeadershipReport });
}

function jsonRequest(body: unknown) {
  return new Request("http://test/api/visibility/audit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
