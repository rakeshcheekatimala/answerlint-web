import { afterEach, describe, expect, it } from "vitest";

import {
  OpenAiSearchAdapter,
  openAiVisibilityTimeoutMs,
} from "@/lib/visibility/adapters/openai-search";

describe("OpenAI web-search visibility adapter", () => {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VISIBILITY_MODEL;

  afterEach(() => {
    process.env.OPENAI_API_KEY = apiKey;
    process.env.OPENAI_VISIBILITY_MODEL = model;
  });

  it("requires both an API key and an explicit model for a controlled run", () => {
    const adapter = new OpenAiSearchAdapter();
    process.env.OPENAI_API_KEY = "test-key";
    delete process.env.OPENAI_VISIBILITY_MODEL;
    expect(adapter.isConfigured()).toBe(false);

    process.env.OPENAI_VISIBILITY_MODEL = "gpt-test";
    expect(adapter.isConfigured()).toBe(true);
  });

  it("bounds provider latency below the worker duration", () => {
    expect(openAiVisibilityTimeoutMs()).toBe(120_000);
    expect(openAiVisibilityTimeoutMs("100")).toBe(10_000);
    expect(openAiVisibilityTimeoutMs("900000")).toBe(240_000);
    expect(openAiVisibilityTimeoutMs("not-a-number")).toBe(120_000);
  });
});
