import { afterEach, describe, expect, it } from "vitest";

import { OpenAiSearchAdapter } from "@/lib/visibility/adapters/openai-search";

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
});
