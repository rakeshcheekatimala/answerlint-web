/**
 * AI Visibility is a closed beta. It must be explicitly enabled in every
 * environment instead of appearing by accident when a deployment has a key.
 */
export function isVisibilityEnabled() {
  const value =
    process.env.NEXT_PUBLIC_ENABLE_AI_VISIBILITY ??
    process.env.ENABLE_AI_VISIBILITY;

  return value?.trim().toLowerCase() === "true";
}
