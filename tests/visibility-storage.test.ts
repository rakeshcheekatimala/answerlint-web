import { beforeEach, describe, expect, it, vi } from "vitest";

import { createVisibilityProjectDraft } from "@/lib/visibility/planner";
import { defaultRuntimePolicy, type VisibilityIntake } from "@/lib/visibility/schema";

const state = vi.hoisted(() => ({
  calls: [] as string[],
  topicsPersisted: false,
}));

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseAdminConfigured: () => true,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => ({
      insert: (record: { id?: string }) => {
        state.calls.push(table);
        if (table === "visibility_projects") {
          return {
            select: () => ({
              single: async () => ({
                data: {
                  id: record.id,
                  created_at: "2026-09-04T00:00:00.000Z",
                  updated_at: "2026-09-04T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          };
        }
        if (table === "visibility_topics") {
          return Promise.resolve().then(() => {
            state.topicsPersisted = true;
            return { error: null };
          });
        }
        if (table === "visibility_prompts" && !state.topicsPersisted) {
          return Promise.resolve({
            error: { message: "visibility_prompts_topic_id_fkey" },
          });
        }
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

import { storeVisibilityProjectBestEffort } from "@/lib/visibility/storage";

const intake: VisibilityIntake = {
  brandUrl: "https://example.com",
  brandName: "Example",
  description: "",
  primaryCategory: "Travel connectivity",
  targetCustomers: "Travellers",
  keyUseCases: ["Choose an eSIM"],
  revenueGoal: "awareness",
  competitors: [],
  markets: ["SG"],
  languages: ["en"],
  surfaces: ["chatgpt_search"],
  runtimePolicy: defaultRuntimePolicy(),
};

describe("AI Visibility project storage", () => {
  beforeEach(() => {
    state.calls = [];
    state.topicsPersisted = false;
  });

  it("waits for topic rows before creating prompt rows with topic foreign keys", async () => {
    const stored = await storeVisibilityProjectBestEffort(createVisibilityProjectDraft(intake));

    expect(stored.storageStatus).toBe("stored");
    expect(state.calls.indexOf("visibility_topics")).toBeLessThan(
      state.calls.indexOf("visibility_prompts"),
    );
  });
});
