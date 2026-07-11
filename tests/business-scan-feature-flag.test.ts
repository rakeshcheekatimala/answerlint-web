import { afterEach, describe, expect, it } from "vitest";

import { isBusinessScanEnabled } from "@/lib/business-scan/feature-flag";

describe("business scan feature flag", () => {
  const originalPublicFlag = process.env.NEXT_PUBLIC_ENABLE_BUSINESS_SCAN;
  const originalServerFlag = process.env.ENABLE_BUSINESS_SCAN;

  afterEach(() => {
    process.env.NEXT_PUBLIC_ENABLE_BUSINESS_SCAN = originalPublicFlag;
    process.env.ENABLE_BUSINESS_SCAN = originalServerFlag;
  });

  it("is enabled by default", () => {
    delete process.env.NEXT_PUBLIC_ENABLE_BUSINESS_SCAN;
    delete process.env.ENABLE_BUSINESS_SCAN;

    expect(isBusinessScanEnabled()).toBe(true);
  });

  it("can be disabled explicitly", () => {
    process.env.NEXT_PUBLIC_ENABLE_BUSINESS_SCAN = "false";

    expect(isBusinessScanEnabled()).toBe(false);
  });
});
