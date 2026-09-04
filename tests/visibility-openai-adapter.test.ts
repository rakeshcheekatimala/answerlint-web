import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OpenAiSearchAdapter,
  openAiVisibilityMaxOutputTokens,
  openAiVisibilityTimeoutMs,
} from "@/lib/visibility/adapters/openai-search";

describe("OpenAI web-search visibility adapter", () => {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VISIBILITY_MODEL;

  afterEach(() => {
    process.env.OPENAI_API_KEY = apiKey;
    process.env.OPENAI_VISIBILITY_MODEL = model;
    vi.unstubAllGlobals();
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

  it("bounds response tokens to a predictable provider budget", () => {
    expect(openAiVisibilityMaxOutputTokens()).toBe(2_000);
    expect(openAiVisibilityMaxOutputTokens("12")).toBe(256);
    expect(openAiVisibilityMaxOutputTokens("50000")).toBe(8_000);
    expect(openAiVisibilityMaxOutputTokens("nope")).toBe(2_000);
  });

  it("sends the output-token cap to the Responses API", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_VISIBILITY_MODEL = "gpt-test";
    const fetchMock = vi.fn<
      [RequestInfo | URL, RequestInit?],
      Promise<Response>
    >(async () =>
      Response.json({ output_text: "Example answer", model: "gpt-test" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await new OpenAiSearchAdapter().execute({
      projectId: "project-1",
      prompt: "What is the best eSIM?",
      manifest: {
        id: "run-1",
        promptId: "prompt-1",
        surface: "chatgpt_search",
        modelRuntime: "pending",
        searchMode: "model_only",
        market: "SG",
        language: "en",
        device: "desktop",
        sessionPolicy: "fresh",
        runAt: new Date().toISOString(),
        repetition: 1,
        rawAnswerArtifactPath: null,
        sourceManifestArtifactPath: null,
        parserVersion: "test",
        parserStatus: "pending",
        status: "running",
      },
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toMatchObject({
      max_output_tokens: 2_000,
      store: false,
    });
  });
});
