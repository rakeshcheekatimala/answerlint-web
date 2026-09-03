import { safeFetch } from "@/lib/net/url-guard";
import { canonicalizeEvidenceUrl } from "@/lib/visibility/evidence";
import type { CitationEvidence } from "@/lib/visibility/types";

const SOURCE_SNAPSHOT_LIMIT = 80_000;

/**
 * Verifies a cited public URL independently of the provider response. This is
 * intentionally conservative: an inaccessible source or one that does not
 * mention the asserted entity cannot support an actionable recommendation.
 */
export async function verifyCitationSource(input: {
  url: string;
  title?: string;
  excerpt?: string;
  /** The entity the specific citation should substantiate. */
  expectedEntities: string[];
  sourceType: CitationEvidence["sourceType"];
}): Promise<{ citation: CitationEvidence; snapshot: string | null }> {
  const canonicalUrl = canonicalizeEvidenceUrl(input.url);
  if (!canonicalUrl) {
    return {
      citation: unverifiedCitation(input, null),
      snapshot: null,
    };
  }

  try {
    const response = await safeFetch(canonicalUrl, {
      timeoutMs: 12_000,
      maxBytes: SOURCE_SNAPSHOT_LIMIT,
      headers: {
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
        "user-agent": "AnswerLintEvidenceVerifier/1.0",
      },
    });
    if (!response.ok) {
      return { citation: unverifiedCitation(input, canonicalUrl), snapshot: null };
    }

    const snapshot = (await response.text()).slice(0, SOURCE_SNAPSHOT_LIMIT);
    const sourceText = visibleText(snapshot);
    const supportsClaim = input.expectedEntities.some((entity) =>
      sourceText.includes(entity.toLocaleLowerCase()),
    );
    return {
      citation: {
        url: input.url,
        canonicalUrl,
        title: input.title ?? null,
        excerpt: input.excerpt ?? null,
        sourceType: input.sourceType,
        resolved: true,
        supportsClaim,
      },
      snapshot,
    };
  } catch {
    return { citation: unverifiedCitation(input, canonicalUrl), snapshot: null };
  }
}

/**
 * A raw HTML substring can match scripts, markup attributes, or tracking data.
 * Entity verification is deliberately conservative and only considers the text
 * a reader could plausibly see on the cited page.
 */
function visibleText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function unverifiedCitation(
  input: {
    url: string;
    title?: string;
    excerpt?: string;
    sourceType: CitationEvidence["sourceType"];
  },
  canonicalUrl: string | null,
): CitationEvidence {
  return {
    url: input.url,
    canonicalUrl,
    title: input.title ?? null,
    excerpt: input.excerpt ?? null,
    sourceType: input.sourceType === "owned" ? "owned" : "unverified",
    resolved: false,
    supportsClaim: false,
  };
}
