import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCrewSignature } from "@/lib/visibility/crew/client";
import { assertVisibilityCrewConfigured, visibilityCrewConfig } from "@/lib/visibility/crew/config";
import { parseVisibilityCrewAnalysis } from "@/lib/visibility/crew/schema";

describe("Visibility Crew configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to a disabled, non-networking mode", () => {
    expect(visibilityCrewConfig({})).toMatchObject({ mode: "disabled", url: null });
  });

  it("requires HTTPS for a production crew endpoint", () => {
    expect(() => visibilityCrewConfig({
      NODE_ENV: "production",
      VISIBILITY_CREW_MODE: "required",
      VISIBILITY_CREW_URL: "http://crew.example.com",
    })).toThrow("HTTPS");
  });

  it("rejects weak shared secrets", () => {
    expect(() => assertVisibilityCrewConfigured({
      mode: "required",
      url: "https://crew.example.com",
      signingSecret: "short",
      keyId: "primary",
      timeoutMs: 90_000,
    })).toThrow("32 characters");
  });
});

describe("Visibility Crew signed contract", () => {
  it("signs the timestamp and exact body with HMAC-SHA256", () => {
    const secret = "s".repeat(32);
    const body = '{"project_id":"project-1"}';
    const expected = crypto.createHmac("sha256", secret).update(`1000.analysis-1.${body}`).digest("hex");
    expect(createCrewSignature(secret, "1000", "analysis-1", body)).toBe(`v1=${expected}`);
  });

  it("parses a strict structured analysis response", () => {
    expect(parseVisibilityCrewAnalysis({
      analysis_id: "analysis-123",
      project_id: "project-123",
      status: "insufficient_evidence",
      model_runtime: "provider/model",
      prompt_version: "answer-evidence-crew/1",
      executive_headline: "More evidence is required",
      executive_summary: "The current cohort does not support a high-confidence action.",
      primary_risk: null,
      findings: [],
      customer_pain_themes: [],
      brand_voice: [],
      executive_decisions: [],
      actions: [],
      limitations: ["Only one run was supplied."],
    })).toMatchObject({
      analysisId: "analysis-123",
      executiveHeadline: "More evidence is required",
    });
  });
});
