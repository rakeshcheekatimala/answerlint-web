import { assertPublicHttpUrl } from "@/lib/net/url-guard";
import {
  visibilityIntakeSchema,
  type VisibilityIntake,
} from "@/lib/visibility/schema";

export class InvalidVisibilityInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidVisibilityInputError";
  }
}

/** Validates browser input before it can create a crawlable visibility project. */
export function parseVisibilityIntake(input: unknown): VisibilityIntake {
  const parsed = visibilityIntakeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new InvalidVisibilityInputError(issue?.message ?? "Invalid visibility setup.");
  }

  try {
    assertPublicHttpUrl(parsed.data.brandUrl);
    for (const competitor of parsed.data.competitors) {
      if (competitor.url) assertPublicHttpUrl(competitor.url);
    }
  } catch (error) {
    throw new InvalidVisibilityInputError(
      error instanceof Error ? error.message : "Invalid URL.",
    );
  }

  return {
    ...parsed.data,
    competitors: parsed.data.competitors.filter(
      (competitor) => competitor.name.trim() || competitor.url.trim(),
    ),
  };
}
