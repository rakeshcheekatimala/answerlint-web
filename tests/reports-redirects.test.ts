import { describe, expect, it } from "vitest";

import {
  buildReportMagicLinkRedirect,
  getPublicSiteOrigin,
} from "@/lib/reports/redirects";

function request(url: string) {
  return new Request(url);
}

describe("report redirects", () => {
  it("uses the explicit public site URL first", () => {
    const origin = getPublicSiteOrigin(request("http://localhost:3000/api"), {
      NEXT_PUBLIC_SITE_URL: "https://useanswerlint.com/",
    });

    expect(origin).toBe("https://useanswerlint.com");
  });

  it("uses the Vercel deployment URL when the public site URL is not set", () => {
    const origin = getPublicSiteOrigin(request("http://localhost:3000/api"), {
      VERCEL_URL: "answerlint-website.vercel.app",
    });

    expect(origin).toBe("https://answerlint-website.vercel.app");
  });

  it("prefers the Vercel production URL over the deployment URL", () => {
    const origin = getPublicSiteOrigin(request("http://localhost:3000/api"), {
      VERCEL_PROJECT_PRODUCTION_URL: "answerlint.vercel.app",
      VERCEL_URL: "feature-branch.vercel.app",
    });

    expect(origin).toBe("https://answerlint.vercel.app");
  });

  it("allows the request origin during local development", () => {
    const origin = getPublicSiteOrigin(request("http://localhost:3010/api"), {
      NODE_ENV: "development",
    });

    expect(origin).toBe("http://localhost:3010");
  });

  it("blocks localhost magic links in production", () => {
    expect(() =>
      getPublicSiteOrigin(request("http://localhost:3000/api"), {
        NODE_ENV: "production",
      }),
    ).toThrow("NEXT_PUBLIC_SITE_URL must be set");
  });

  it("builds the report unlock callback with the report token preserved", () => {
    const redirectTo = buildReportMagicLinkRedirect({
      origin: "https://useanswerlint.com",
      reportId: "report id",
      claimToken: "token/with+chars",
    });

    expect(redirectTo).toBe(
      "https://useanswerlint.com/auth/confirm?next=%2Ftools%2Fgeo-audit%2Freport%3Fid%3Dreport%2520id%26token%3Dtoken%252Fwith%252Bchars",
    );
  });
});
