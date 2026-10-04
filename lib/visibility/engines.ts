import { OpenAiSearchAdapter } from "@/lib/visibility/adapters/openai-search";
import type { RunManifest } from "@/lib/visibility/types";
import { parseAnswerSignals } from "@/lib/visibility/observation-parser";

import type { EngineId } from "@/lib/visibility/leadership";

export type EngineConfig = {
  id: EngineId;
  label: string;
  connected: boolean;
  model: string;
};

export type EngineAnswer = {
  excerpt: string | null;
  citationUrls: string[];
  brandMentioned: boolean;
  citedInstead: string[];
};

const PAGE_TIMEOUT_MS = 12_000;
const DEFAULT_MODEL = "gpt-5.6-terra";

export function listEngines(): EngineConfig[] {
  const openai = process.env.OPENAI_API_KEY?.trim() ?? "";
  return [
    {
      id: "chatgpt",
      label: "ChatGPT",
      connected: Boolean(openai),
      model: process.env.OPENAI_VISIBILITY_MODEL?.trim() || DEFAULT_MODEL,
    },
  ];
}

export async function askEngine(input: {
  engine: EngineId;
  model: string;
  prompt: string;
  brandName: string;
  competitors: string[];
}): Promise<EngineAnswer> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("ChatGPT needs an API key.");
  const adapter = new OpenAiSearchAdapter();
  const result = await adapter.execute({
    projectId: "page-audit",
    prompt: input.prompt,
    model: input.model,
    timeoutMs: PAGE_TIMEOUT_MS,
    manifest: pageManifest(input.model),
  });
  const citationUrls = [
    ...result.sources.map((source) => source.url),
    ...result.citations.map((citation) => citation.url),
  ];
  const parsed = parseAnswerSignals({
    rawAnswer: result.rawAnswer,
    brandName: input.brandName,
    competitors: input.competitors,
  });
  const excerpt = result.rawAnswer.replace(/\s+/g, " ").trim().slice(0, 180);
  return {
    excerpt: excerpt || null,
    citationUrls: [...new Set(citationUrls)],
    brandMentioned: parsed.brandMentioned,
    citedInstead: parsed.competitorMentions,
  };
}

function pageManifest(model: string): RunManifest {
  return {
    id: "page-audit",
    promptId: "page-audit",
    surface: "chatgpt_search",
    modelRuntime: model,
    searchMode: "search_enabled",
    market: "",
    language: "en",
    device: "desktop",
    sessionPolicy: "fresh",
    runAt: new Date().toISOString(),
    repetition: 1,
    rawAnswerArtifactPath: null,
    sourceManifestArtifactPath: null,
    parserVersion: "page-audit",
    parserStatus: "pending",
    status: "running",
  };
}
