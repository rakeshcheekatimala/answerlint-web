import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

export const VISIBILITY_ARTIFACT_BUCKET = "visibility-artifacts";

/** Stores raw provider output separately from reporting rows for auditability. */
export async function storeVisibilityTextArtifact(input: {
  projectId: string;
  runId: string;
  kind: "raw-answer" | "source-snapshot" | "provider-sources";
  sequence?: number;
  text: string;
}): Promise<string | null> {
  if (!isSupabaseAdminConfigured()) return null;

  const sequence = input.sequence === undefined ? "" : `-${input.sequence}`;
  const path = `${input.projectId}/runs/${input.runId}/${input.kind}${sequence}.txt`;
  const { error } = await createSupabaseAdminClient()
    .storage
    .from(VISIBILITY_ARTIFACT_BUCKET)
    .upload(path, Buffer.from(input.text, "utf8"), {
      contentType: "text/plain; charset=utf-8",
      // Run IDs are deterministic for retry safety. Replaying the same durable
      // step replaces only that exact immutable run path.
      upsert: true,
    });

  if (error) throw new Error(`Unable to store evidence artifact: ${error.message}`);
  return path;
}
