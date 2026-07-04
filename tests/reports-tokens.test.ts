import { describe, expect, it } from "vitest";

import {
  createClaimToken,
  formatSupabaseStorageError,
  hashClaimToken,
} from "@/lib/reports/tokens";

describe("report claim tokens", () => {
  it("creates URL-safe high-entropy claim tokens", () => {
    const token = createClaimToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it("hashes tokens deterministically without returning the original token", () => {
    const token = "secure-token";
    const hash = hashClaimToken(token);

    expect(hash).toBe(hashClaimToken(token));
    expect(hash).not.toContain(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("turns Supabase schema-cache errors into setup guidance", () => {
    const formatted = formatSupabaseStorageError(
      "Could not find the table 'public.audit_reports' in the schema cache",
    );

    expect(formatted).toContain("Supabase report tables are not ready.");
    expect(formatted).toContain("supabase/audit-reports.sql");
    expect(formatted).toContain("Original Supabase error");
  });

  it("leaves unrelated storage errors unchanged", () => {
    expect(formatSupabaseStorageError("permission denied")).toBe(
      "permission denied",
    );
  });
});
