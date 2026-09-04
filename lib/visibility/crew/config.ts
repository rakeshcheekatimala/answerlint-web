export type VisibilityCrewMode = "disabled" | "best_effort" | "required";

export type VisibilityCrewConfig = {
  mode: VisibilityCrewMode;
  url: string | null;
  signingSecret: string | null;
  keyId: string;
  timeoutMs: number;
};

function modeFromEnv(value: string | undefined): VisibilityCrewMode {
  return value === "required" || value === "best_effort" ? value : "disabled";
}

export function visibilityCrewConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): VisibilityCrewConfig {
  const mode = modeFromEnv(env.VISIBILITY_CREW_MODE);
  const rawUrl = env.VISIBILITY_CREW_URL?.trim();
  const signingSecret = env.VISIBILITY_CREW_SIGNING_SECRET?.trim() || null;
  const timeout = Number(env.VISIBILITY_CREW_TIMEOUT_MS ?? "90000");
  return {
    mode,
    url: rawUrl ? normalizeCrewUrl(rawUrl, env.NODE_ENV) : null,
    signingSecret,
    keyId: env.VISIBILITY_CREW_KEY_ID?.trim() || "primary",
    timeoutMs: Number.isFinite(timeout) ? Math.min(300_000, Math.max(10_000, timeout)) : 90_000,
  };
}

export function assertVisibilityCrewConfigured(config = visibilityCrewConfig()) {
  if (config.mode === "disabled") return;
  if (!config.url) throw new Error("VISIBILITY_CREW_URL is required when CrewAI is enabled.");
  if (!config.signingSecret || config.signingSecret.length < 32) {
    throw new Error("VISIBILITY_CREW_SIGNING_SECRET must contain at least 32 characters.");
  }
}

function normalizeCrewUrl(input: string, nodeEnv: string | undefined) {
  const url = new URL(input);
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.protocol !== "https:" && !(nodeEnv !== "production" && local && url.protocol === "http:")) {
    throw new Error("VISIBILITY_CREW_URL must use HTTPS outside local development.");
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
