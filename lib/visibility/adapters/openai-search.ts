import type {
  SurfaceExecutionRequest,
  SurfaceExecutionResult,
  VisibilitySurfaceAdapter,
} from "@/lib/visibility/adapters/types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_VISIBILITY_TIMEOUT_MS = 120_000;

type OpenAiCitation = {
  type?: string;
  url?: string;
  title?: string;
};

type OpenAiContent = {
  text?: string;
  annotations?: OpenAiCitation[];
};

type OpenAiSource = {
  url?: string;
  title?: string;
};

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: OpenAiContent[];
    action?: { sources?: OpenAiSource[] };
  }>;
  model?: string;
};

/** Official OpenAI Responses API adapter for a controlled OpenAI web-search run. */
export class OpenAiSearchAdapter implements VisibilitySurfaceAdapter {
  readonly surface = "chatgpt_search" as const;

  isConfigured() {
    return Boolean(
      process.env.OPENAI_API_KEY?.trim() &&
      process.env.OPENAI_VISIBILITY_MODEL?.trim(),
    );
  }

  async execute(request: SurfaceExecutionRequest): Promise<SurfaceExecutionResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY for the OpenAI web-search adapter.");
    }
    const model = process.env.OPENAI_VISIBILITY_MODEL?.trim();
    if (!model) {
      throw new Error("Missing OPENAI_VISIBILITY_MODEL for the controlled OpenAI web-search run.");
    }

    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        ...(request.manifest.searchMode === "search_enabled"
          ? {
              tools: [
                {
                  type: "web_search",
                  user_location: {
                    type: "approximate",
                    country: request.manifest.market,
                  },
                },
              ],
              // A search-enabled benchmark must actually search. The default `auto`
              // mode can return a perfectly valid model-only answer that is not
              // comparable with a search-enabled run.
              tool_choice: "required",
              include: ["web_search_call.action.sources"],
            }
          : {}),
        input: request.prompt,
      }),
      signal: AbortSignal.timeout(openAiVisibilityTimeoutMs()),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`OpenAI visibility request failed with ${response.status}: ${await response.text()}`);
    }

    const payload = (await response.json()) as OpenAiResponse;
    const content = payload.output?.flatMap((item) => item.content ?? []) ?? [];
    const rawAnswer =
      payload.output_text?.trim() ||
      content
        .map((part) => part.text)
        .filter((text): text is string => Boolean(text))
        .join("\n")
        .trim();

    if (!rawAnswer) throw new Error("OpenAI returned an empty answer.");

    const citations = content
      .flatMap((part) => part.annotations ?? [])
      .filter((annotation) => annotation.type === "url_citation" && Boolean(annotation.url))
      .map((annotation) => ({
        url: annotation.url as string,
        title: annotation.title,
      }));
    const sources = payload.output
      ?.flatMap((item) => item.action?.sources ?? [])
      .filter((source) => Boolean(source.url))
      .map((source) => ({ url: source.url as string, title: source.title })) ?? [];

    return {
      rawAnswer,
      modelRuntime: payload.model ?? model,
      citations,
      sources: dedupeSources([...sources, ...citations]),
    };
  }
}

export function openAiVisibilityTimeoutMs(
  value = process.env.OPENAI_VISIBILITY_TIMEOUT_MS,
) {
  const timeout = Number(value ?? DEFAULT_OPENAI_VISIBILITY_TIMEOUT_MS);
  return Number.isFinite(timeout)
    ? Math.min(240_000, Math.max(10_000, timeout))
    : DEFAULT_OPENAI_VISIBILITY_TIMEOUT_MS;
}

function dedupeSources(sources: Array<{ url: string; title?: string }>) {
  const byUrl = new Map<string, { url: string; title?: string }>();
  for (const source of sources) {
    if (!byUrl.has(source.url)) byUrl.set(source.url, source);
  }
  return [...byUrl.values()];
}
