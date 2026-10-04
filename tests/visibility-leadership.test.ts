import { describe, expect, it, vi } from "vitest";

import { discoverFromHtml } from "@/lib/visibility/discover";
import {
  buildLeadershipReport,
  cellCacheKey,
  type EngineCell,
} from "@/lib/visibility/leadership";
import { clearCellMemory } from "@/lib/visibility/cell-store";
import { runAudit } from "@/lib/visibility/run-report";
import type { PageProbe } from "@/lib/visibility/site-audit";

const singtelHtml = `<!doctype html><html><head>
<title>Singtel: Mobile, Fibre Broadband and TV services provider</title>
<meta name="description" content="The Singtel Group, Asia's leading communications group provides a diverse range of services including fixed, mobile, data, internet, TV.">
<link rel="canonical" href="https://www.singtel.com/personal"/>
</head><body>
<h2></h2>
<h3>Can I use eSIM instead of a physical SIM?</h3>
<div data="{&quot;title&quot;:&quot;Ready to switch?&quot;,&quot;desc&quot;:&quot;Port-in to SG's Safest Network.&quot;,&quot;linkName&quot;:&quot;Plans&quot;}"></div>
</body></html>`;

describe("discovery", () => {
  it("does not invent a rival the page does not name", () => {
    const found = discoverFromHtml(singtelHtml, "https://www.singtel.com/");
    expect(found.brandName).toBe("Singtel");
    expect(found.competitors).toEqual([]);
    expect(found.competitorNote).toBe("No competitor was found on the site.");
    expect(found.prompts).toContain("Ready to switch?");
    expect(found.prompts).toContain("Can I use eSIM instead of a physical SIM?");
    expect(found.prompts).not.toContain("Plans");
  });

  it("keeps a rival only when the page names one", () => {
    const html = `<!doctype html><html><head><title>Acme: Widgets</title></head><body>
      <a href="https://rival.example/alternative">Acme vs RivalCo</a>
      <h2>How do I switch plans?</h2>
    </body></html>`;
    const found = discoverFromHtml(html, "https://acme.example/");
    expect(found.competitors).toEqual([
      expect.objectContaining({ name: "RivalCo", url: "https://rival.example/alternative" }),
    ]);
    expect(found.prompts).toContain("How do I switch plans?");
  });
});

describe("leadership report", () => {
  it("leaves share blank when an engine did not run and does not call a missing engine", async () => {
    clearCellMemory();
    const ask = vi.fn(() => {
      throw new Error("should not run");
    });
    const events: Array<{ type: string; report?: ReturnType<typeof buildLeadershipReport> }> = [];
    await runAudit(
      {
        phase: "report",
        pageUrl: "https://example.com/",
        domain: "example.com",
        brandName: "Example",
        prompts: ["How should teams prepare?"],
        competitors: [],
        competitorNote: "No competitor was found on the site.",
      },
      (event) => events.push(event as { type: string; report?: ReturnType<typeof buildLeadershipReport> }),
      {
        probe: async (target) => page(target),
        engines: [{ id: "chatgpt", label: "ChatGPT", connected: false, model: "gpt" }],
        ask,
        now: () => "2026-10-04T00:00:00.000Z",
      },
    );
    expect(ask).not.toHaveBeenCalled();
    const report = events.find((event) => event.type === "report")?.report;
    expect(report?.summary).toBe("ChatGPT needs an API key.");
    expect(report?.columns.map((column) => column.engine)).toEqual(["chatgpt"]);
    expect(report?.citationRows[0]?.shares).toEqual([null]);
    expect(report?.missingPrompts).toEqual([]);
    expect(report?.unscoredPrompts).toEqual(["How should teams prepare?"]);
    expect(report?.fixes.length).toBeLessThan(5);
  });

  it("reuses a saved cell instead of calling the engine again", async () => {
    clearCellMemory();
    const prompt = "How should teams prepare?";
    const cell = savedCell(prompt);
    const ask = vi.fn();
    const events: Array<{ type: string; report?: ReturnType<typeof buildLeadershipReport> }> = [];
    await runAudit(
      {
        phase: "report",
        pageUrl: "https://example.com/",
        domain: "example.com",
        brandName: "Example",
        prompts: [prompt],
        competitors: [{ name: "Rival", url: "https://rival.example" }],
        cachedCells: [cell],
      },
      (event) => events.push(event as { type: string; report?: ReturnType<typeof buildLeadershipReport> }),
      {
        probe: async (target) => page(target, target.role === "brand"),
        engines: [{ id: "chatgpt", label: "ChatGPT", connected: true, model: "test-model" }],
        ask,
        now: () => "2026-10-04T00:00:00.000Z",
      },
    );
    expect(ask).not.toHaveBeenCalled();
    const report = events.find((event) => event.type === "report")?.report;
    expect(report?.citationRows.map((row) => row.shares)).toEqual([[0], [100]]);
    expect(report?.missingPrompts[0]).toMatchObject({ prompt, citedInstead: ["Rival"] });
    expect(report?.fixes[0]?.title).toContain("How should teams prepare?");
  });

  it("leaves a competitor share blank when saved answers never mention them", () => {
    const report = buildLeadershipReport({
      brandName: "Example",
      domain: "example.com",
      brandUrl: "https://example.com/",
      prompts: ["How should teams prepare?"],
      competitors: [{ name: "Other", url: "https://other.example" }],
      competitorNote: "Competitors you added.",
      pages: [page({ role: "brand", name: "Example", url: "https://example.com/" })],
      cells: [
        {
          ...savedCell("How should teams prepare?"),
          brandMentioned: true,
          citedInstead: [],
          citationUrls: ["https://example.com/guide"],
        },
      ],
      checkedAt: "2026-10-04T00:00:00.000Z",
    });
    expect(report.citationRows.map((row) => [row.name, row.shares])).toEqual([
      ["Example", [100]],
      ["Other", [null]],
    ]);
  });

  it("does not turn an empty saved answer into zero percent", () => {
    const report = buildLeadershipReport({
      brandName: "Example",
      domain: "example.com",
      brandUrl: "https://example.com/",
      prompts: ["How should teams prepare?"],
      competitors: [{ name: "Rival", url: "https://rival.example" }],
      competitorNote: "These competitors were named on the public site.",
      pages: [page({ role: "brand", name: "Example", url: "https://example.com/" })],
      cells: [
        {
          ...savedCell("How should teams prepare?"),
          brandMentioned: false,
          citedInstead: [],
          citationUrls: [],
        },
      ],
      checkedAt: "2026-10-04T00:00:00.000Z",
    });
    expect(report.citationRows[0]?.shares[0]).toBeNull();
    expect(report.columns[0]?.state).toBe("no_citations");
    expect(report.missingPrompts).toHaveLength(1);
  });

  it("ranks a cited miss ahead of a technical gap and does not pad to five", () => {
    const report = buildLeadershipReport({
      brandName: "Example",
      domain: "example.com",
      brandUrl: "https://example.com/",
      prompts: ["How should teams prepare?"],
      competitors: [{ name: "Rival", url: null }],
      competitorNote: "These competitors were named on the public site.",
      pages: [
        page({
          role: "brand",
          name: "Example",
          url: "https://example.com/",
          heading: null,
          hasDirectAnswer: true,
          canonical: "https://example.com/",
          schemaTypes: ["FAQPage"],
          citationSignals: ["author"],
        }),
      ],
      cells: [savedCell("How should teams prepare?")],
      checkedAt: "2026-10-04T00:00:00.000Z",
    });
    expect(report.fixes.map((fix) => fix.title)[0]).toContain("How should teams prepare?");
    expect(report.fixes.map((fix) => fix.title)).toContain("Add a heading");
    expect(report.fixes.length).toBeLessThan(5);
    expect(report.fixes.some((fix) => /generic|content strategy/i.test(fix.title))).toBe(false);
  });
});

function savedCell(prompt: string): EngineCell {
  return {
    key: cellCacheKey("example.com", prompt, "chatgpt", "test-model"),
    domain: "example.com",
    prompt,
    engine: "chatgpt",
    model: "test-model",
    status: "saved",
    ranAt: "2026-10-04T00:00:00.000Z",
    brandMentioned: false,
    citedInstead: ["Rival"],
    citationUrls: ["https://rival.example/post"],
    excerpt: "Rival is the usual pick.",
    fromCache: false,
    error: null,
  };
}

function page(
  partial: Partial<PageProbe> & Pick<PageProbe, "role" | "name" | "url">,
  opened = true,
): PageProbe {
  return {
    opened,
    statusCode: opened ? 200 : null,
    error: opened ? null : "The site returned 404.",
    title: "Example",
    heading: "Prepare",
    canonical: "https://example.com/",
    hasDirectAnswer: true,
    schemaTypes: ["FAQPage"],
    citationSignals: ["author"],
    ...partial,
  };
}
