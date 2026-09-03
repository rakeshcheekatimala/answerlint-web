/** Header carrying the anonymous project capability until account auth is enabled. */
export const VISIBILITY_PROJECT_TOKEN_HEADER = "x-answerlint-visibility-token";

/** A conservative ceiling for one durable benchmark. Projects can be re-run later. */
/** Eight approved prompts × one supported surface × three repeats. */
export const DEFAULT_VISIBILITY_BASELINE_RUNS = 24;

/**
 * A project may add up to four decision prompts after its baseline. This is a
 * hard provider-call budget, not an estimate shown only in the UI.
 */
export const MAX_VISIBILITY_RUNS_PER_BENCHMARK = 28;

/** Bound downstream source fetches even when a provider returns a large source set. */
export const MAX_VISIBILITY_CITATIONS_PER_RUN = 12;

/** Prevent a source-heavy provider answer from turning into an unbounded crawl. */
export const MAX_VISIBILITY_SOURCE_FETCHES_PER_BENCHMARK = 96;
