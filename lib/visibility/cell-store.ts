import { isSupabaseAdminConfigured } from "@/lib/supabase/config";

import type { EngineCell } from "@/lib/visibility/leadership";

const memory = new Map<string, EngineCell>();

export function rememberCell(cell: EngineCell) {
  if (cell.status !== "saved") return;
  memory.set(cell.key, { ...cell, fromCache: true });
}

export function recallCell(key: string) {
  return memory.get(key) ?? null;
}

export function clearCellMemory() {
  memory.clear();
}

export async function readStoredCell(key: string): Promise<EngineCell | null> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("visibility_answer_cells")
      .select("payload")
      .eq("cache_key", key)
      .maybeSingle();
    if (error || !data?.payload) return null;
    return data.payload as EngineCell;
  } catch {
    return null;
  }
}

export async function writeStoredCell(cell: EngineCell) {
  if (cell.status !== "saved" || !isSupabaseAdminConfigured()) return;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createSupabaseAdminClient();
    await supabase.from("visibility_answer_cells").upsert({
      cache_key: cell.key,
      domain: cell.domain,
      engine: cell.engine,
      model: cell.model,
      prompt: cell.prompt,
      payload: cell,
      saved_at: cell.ranAt ?? new Date().toISOString(),
    });
  } catch {
    // Storage is optional. A failed write must not fail the report.
  }
}
