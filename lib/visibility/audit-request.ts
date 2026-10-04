import { z } from "zod";

import { UnsafeUrlError, assertPublicHttpUrl } from "@/lib/net/url-guard";
import { ENGINE_IDS, type EngineCell } from "@/lib/visibility/leadership";
import type { AuditInput } from "@/lib/visibility/run-report";

const cellSchema = z.object({
  key: z.string(),
  domain: z.string(),
  prompt: z.string(),
  engine: z.enum(ENGINE_IDS),
  model: z.string(),
  status: z.enum(["saved", "not_connected", "error", "stopped"]),
  ranAt: z.string().nullable(),
  brandMentioned: z.boolean().nullable(),
  citedInstead: z.array(z.string()),
  citationUrls: z.array(z.string()),
  excerpt: z.string().nullable(),
  fromCache: z.boolean(),
  error: z.string().nullable(),
});

const requestSchema = z.object({
  domain: z.string({ error: "Enter a company domain." }).trim().min(1, "Enter a company domain."),
  phase: z.enum(["discover", "report"]).optional(),
  brandName: z.string().trim().max(120).optional(),
  prompts: z.array(z.string().trim().min(1).max(180)).max(6).optional(),
  competitors: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        url: z.string().trim().max(2_048).optional().nullable(),
      }),
    )
    .max(4)
    .optional(),
  competitorNote: z.string().trim().max(240).optional(),
  cachedCells: z.array(z.unknown()).max(48).optional(),
});

export class InvalidSiteAuditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSiteAuditError";
  }
}

export function parseVisibilityAuditRequest(input: unknown): AuditInput {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    throw new InvalidSiteAuditError(parsed.error.issues[0]?.message ?? "Enter a company domain.");
  }
  const pageUrl = companyUrl(parsed.data.domain);
  const domain = pageUrl.hostname.replace(/^www\./i, "").toLowerCase();
  const competitors = (parsed.data.competitors ?? []).map((competitor) => ({
    name: competitor.name,
    url: competitor.url ? companyUrl(competitor.url).toString() : null,
  }));
  return {
    phase: parsed.data.phase ?? "discover",
    pageUrl: pageUrl.toString(),
    domain,
    brandName: parsed.data.brandName,
    prompts: parsed.data.prompts,
    competitors,
    competitorNote: parsed.data.competitorNote,
    cachedCells: (parsed.data.cachedCells ?? []).flatMap((cell) => {
      const result = cellSchema.safeParse(cell);
      return result.success ? [result.data satisfies EngineCell] : [];
    }),
  };
}

function companyUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) throw new InvalidSiteAuditError("Enter a company domain.");
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return assertPublicHttpUrl(withProtocol);
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw new InvalidSiteAuditError(error.message);
    throw new InvalidSiteAuditError("The URL is not valid.");
  }
}
