import type { VisibilitySurface } from "@/lib/visibility/types";
import { OpenAiSearchAdapter } from "@/lib/visibility/adapters/openai-search";
import {
  ProviderConfigurationError,
  type SurfaceExecutionRequest,
  type SurfaceExecutionResult,
  type VisibilitySurfaceAdapter,
} from "@/lib/visibility/adapters/types";

class UnconfiguredSurfaceAdapter implements VisibilitySurfaceAdapter {
  constructor(readonly surface: VisibilitySurface) {}

  isConfigured() {
    return false;
  }

  async execute(_request: SurfaceExecutionRequest): Promise<SurfaceExecutionResult> {
    void _request;
    throw new ProviderConfigurationError(this.surface);
  }
}

const adapters: Record<VisibilitySurface, VisibilitySurfaceAdapter> = {
  chatgpt_search: new OpenAiSearchAdapter(),
  perplexity: new UnconfiguredSurfaceAdapter("perplexity"),
  google_ai_overview: new UnconfiguredSurfaceAdapter("google_ai_overview"),
  claude: new UnconfiguredSurfaceAdapter("claude"),
};

export function getVisibilitySurfaceAdapter(surface: VisibilitySurface) {
  return adapters[surface];
}

export function configuredVisibilitySurfaces(): VisibilitySurface[] {
  return (Object.keys(adapters) as VisibilitySurface[]).filter((surface) =>
    adapters[surface].isConfigured(),
  );
}
