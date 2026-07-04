import { describe, expect, it } from "vitest";

import {
  canFailOpen,
  getReportAccessConfig,
  shouldCaptureEmail,
  shouldRequireGoogleLogin,
  shouldSendMagicLink,
} from "@/lib/reports/access";

describe("report access flags", () => {
  it("defaults to the MVP email-capture flow", () => {
    const config = getReportAccessConfig({});

    expect(config).toEqual({
      accessMode: "email_capture",
      storageMode: "best_effort",
      captureFailMode: "open",
      googleAuthEnabled: false,
    });
    expect(shouldCaptureEmail(config)).toBe(true);
    expect(canFailOpen(config)).toBe(true);
  });

  it("supports open mode as the emergency fallback", () => {
    const config = getReportAccessConfig({
      NEXT_PUBLIC_REPORT_ACCESS_MODE: "open",
      REPORT_STORAGE_MODE: "disabled",
    });

    expect(config.accessMode).toBe("open");
    expect(config.storageMode).toBe("disabled");
    expect(shouldCaptureEmail(config)).toBe(false);
  });

  it("keeps Google and magic-link modes explicitly opt-in", () => {
    const googleConfig = getReportAccessConfig({
      NEXT_PUBLIC_REPORT_ACCESS_MODE: "google_login",
      NEXT_PUBLIC_ENABLE_GOOGLE_AUTH: "true",
    });
    const magicLinkConfig = getReportAccessConfig({
      NEXT_PUBLIC_REPORT_ACCESS_MODE: "magic_link",
      REPORT_CAPTURE_FAIL_MODE: "closed",
    });

    expect(shouldRequireGoogleLogin(googleConfig)).toBe(true);
    expect(googleConfig.googleAuthEnabled).toBe(true);
    expect(shouldSendMagicLink(magicLinkConfig)).toBe(true);
    expect(canFailOpen(magicLinkConfig)).toBe(false);
  });

  it("falls back safely when env values are invalid", () => {
    const config = getReportAccessConfig({
      NEXT_PUBLIC_REPORT_ACCESS_MODE: "unknown",
      REPORT_STORAGE_MODE: "unknown",
      REPORT_CAPTURE_FAIL_MODE: "unknown",
    });

    expect(config.accessMode).toBe("email_capture");
    expect(config.storageMode).toBe("best_effort");
    expect(config.captureFailMode).toBe("open");
  });
});
