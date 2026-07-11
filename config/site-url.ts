/**
 * Canonical origin for metadata and JSON-LD. Override with NEXT_PUBLIC_SITE_URL on Vercel.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://useanswerlint.com"
).replace(/\/$/, "");
