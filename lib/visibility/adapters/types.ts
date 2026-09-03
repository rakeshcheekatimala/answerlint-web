import type { RunManifest, VisibilitySurface } from "@/lib/visibility/types";

export type SurfaceExecutionRequest = {
  projectId: string;
  manifest: RunManifest;
  prompt: string;
};

export type SurfaceExecutionResult = {
  rawAnswer: string;
  modelRuntime: string;
  citations: Array<{ url: string; title?: string; excerpt?: string }>;
  /** URLs consulted by the provider, including sources not cited inline. */
  sources: Array<{ url: string; title?: string }>;
};

/**
 * Provider interfaces deliberately remain surface-specific. Citation and search
 * semantics are recorded explicitly instead of being hidden behind an agent API.
 */
export interface VisibilitySurfaceAdapter {
  readonly surface: VisibilitySurface;
  isConfigured(): boolean;
  execute(request: SurfaceExecutionRequest): Promise<SurfaceExecutionResult>;
}

export class ProviderConfigurationError extends Error {
  constructor(surface: VisibilitySurface) {
    super(`${surface} is not configured for visibility benchmarking.`);
    this.name = "ProviderConfigurationError";
  }
}
