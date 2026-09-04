import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyProjectApprovals } from "@/lib/visibility/lifecycle";
import { createVisibilityProjectDraft } from "@/lib/visibility/planner";
import {
  defaultRuntimePolicy,
  type VisibilityIntake,
} from "@/lib/visibility/schema";

const state = vi.hoisted(() => ({
  completions: [] as string[],
}));

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseAdminConfigured: () => true,
}));

vi.mock("@/lib/reports/tokens", () => ({
  createClaimToken: () => "edit-token",
  hashClaimToken: (token: string) => `hash:${token}`,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { owner_token_hash: "hash:edit-token" },
            error: null,
          }),
        }),
      }),
      update: (values: { included?: boolean }) => ({
        eq: () => {
          if (table !== "visibility_topics") {
            return Promise.resolve({ error: null });
          }
          if (values.included === false) {
            return new Promise<{ error: null }>((resolve) => {
              setTimeout(() => {
                state.completions.push("reset");
                resolve({ error: null });
              }, 5);
            });
          }
          return {
            in: async () => {
              state.completions.push("enable");
              return { error: null };
            },
          };
        },
      }),
      upsert: async () => ({ error: null }),
    }),
  }),
}));

import { updateVisibilityProjectApprovals } from "@/lib/visibility/storage";

const intake: VisibilityIntake = {
  brandUrl: "https://example.com",
  brandName: "Example",
  description: "Example provides travel connectivity.",
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

describe("AI Visibility approval storage", () => {
  beforeEach(() => {
    state.completions = [];
  });

  it("finishes the topic reset before enabling the approved cohort", async () => {
    const draft = {
      ...createVisibilityProjectDraft(intake),
      id: "7c808f1c-ba9b-4e37-8100-d439237e8d44",
    };
    const brandApproved = applyProjectApprovals(draft, { brandCard: true });
    const approved = applyProjectApprovals(brandApproved, {
      topicIds: [brandApproved.topics[0].id],
      prompts: brandApproved.prompts.map((prompt, index) => ({
        id: prompt.id,
        text: prompt.text,
        included: index === 0,
      })),
    });

    const stored = await updateVisibilityProjectApprovals(
      approved,
      "edit-token",
    );

    expect(stored.state).toBe("ready_to_benchmark");
    expect(state.completions).toEqual(["reset", "enable"]);
  });
});
