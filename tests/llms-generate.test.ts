import { beforeEach, describe, expect, it, vi } from "vitest";

const { safeFetch, assertPublicUrl } = vi.hoisted(() => ({
  safeFetch: vi.fn(),
  assertPublicUrl: vi.fn(async (value: string) => new URL(value)),
}));

vi.mock("@/lib/net/url-guard", () => ({ safeFetch, assertPublicUrl }));

import { generateLlmsFiles } from "@/lib/llms/generate";

function html(title: string, description: string, body = "Useful page content.") {
  return `<!doctype html><html><head><title>${title}</title><meta name="description" content="${description}"></head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
}

beforeEach(() => {
  safeFetch.mockReset();
});

describe("llms.txt generation", () => {
  it("discovers sitemap pages and rewrites staging links to production", async () => {
    safeFetch.mockImplementation(async (url: string) => {
      if (url === "https://preview.example.dev/") {
        return new Response(html("Example", "Product documentation and guides."), {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      if (url === "https://preview.example.dev/sitemap.xml") {
        return new Response(
          "<urlset><url><loc>https://preview.example.dev/docs/start</loc></url></urlset>",
          { status: 200, headers: { "content-type": "application/xml" } },
        );
      }
      if (url === "https://preview.example.dev/docs/start") {
        return new Response(
          html("Getting started", "Install and configure the product."),
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const result = await generateLlmsFiles({
      url: "https://preview.example.dev/",
      publicSite: "https://example.com",
      siteName: "Example Site",
      includeFull: true,
    });

    expect(result.sourceCount).toBe(2);
    expect(result.llmsTxt).toContain("# Example Site");
    expect(result.llmsTxt).toContain(
      "[Getting started](https://example.com/docs/start)",
    );
    expect(result.llmsFullTxt).toContain("# Example Site Full Context");
  });

  it("falls back to same-site homepage links when no sitemap is available", async () => {
    safeFetch.mockImplementation(async (url: string) => {
      if (url.endsWith("sitemap.xml") || url.endsWith("sitemap_index.xml")) {
        return new Response("Not found", { status: 404 });
      }
      if (url === "https://example.com/") {
        return new Response(
          html(
            "Example",
            "Example product site.",
            '<a href="/pricing">Pricing</a><a href="https://other.test">Other</a>',
          ),
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      return new Response(html("Pricing", "Plans and product pricing."), {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    });

    const result = await generateLlmsFiles({ url: "https://example.com/" });

    expect(result.sourceCount).toBe(2);
    expect(result.llmsTxt).toContain("https://example.com/pricing");
    expect(result.llmsTxt).not.toContain("other.test");
  });
});
