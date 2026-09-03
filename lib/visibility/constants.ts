/** Header carrying the anonymous project capability until account auth is enabled. */
export const VISIBILITY_PROJECT_TOKEN_HEADER = "x-answerlint-visibility-token";

/** A conservative ceiling for one durable benchmark. Projects can be re-run later. */
export const MAX_VISIBILITY_RUNS_PER_BENCHMARK = 36;

/** Bound downstream source fetches even when a provider returns a large source set. */
export const MAX_VISIBILITY_CITATIONS_PER_RUN = 12;
