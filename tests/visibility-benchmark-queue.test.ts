import { beforeEach, describe, expect, it, vi } from "vitest";

import { createVisibilityProjectDraft } from "@/lib/visibility/planner";
import { createClaimToken, hashClaimToken } from "@/lib/reports/tokens";
import { defaultRuntimePolicy, type VisibilityIntake } from "@/lib/visibility/schema";

const database = vi.hoisted(() => ({
  state: "ready_to_benchmark",
  ownerHash: "",
}));

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseAdminConfigured: () => true,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: () => {
        const query = {
          eq: () => query,
          single: async () => ({
            data: { owner_token_hash: database.ownerHash },
            error: null,
          }),
        };
        return query;
      },
      update: (updates: { state: string }) => {
        const filters = new Map<string, string>();
        const query = {
          eq: (field: string, value: string) => {
            filters.set(field, value);
            return query;
          },
          select: () => query,
          maybeSingle: async () => {
            if (database.state !== filters.get("state")) {
              return { data: null, error: null };
            }
            database.state = updates.state;
            return { data: { id: filters.get("id") }, error: null };
          },
        };
        return query;
      },
    }),
  }),
}));

import {
  queueVisibilityBenchmark,
  VisibilityBenchmarkConflictError,
} from "@/lib/visibility/storage";

const intake: VisibilityIntake = {
  brandUrl: "https://example.com",
  brandName: "Example",
  description: "",
  primaryCategory: "Travel connectivity",
  targetCustomers: "Travellers",
  keyUseCases: ["Choose an eSIM"],
  revenueGoal: "pipeline",
  competitors: [],
  markets: ["SG"],
  languages: ["en"],
  surfaces: ["chatgpt_search"],
  runtimePolicy: defaultRuntimePolicy(),
};

describe("visibility benchmark admission", () => {
  beforeEach(() => {
    database.state = "ready_to_benchmark";
  });

  it("allows only one concurrent caller to claim a ready cohort", async () => {
    const token = createClaimToken();
    database.ownerHash = hashClaimToken(token);
    const project = {
      ...createVisibilityProjectDraft(intake),
      state: "ready_to_benchmark" as const,
      storageStatus: "stored" as const,
    };
    const progress = {
      benchmarkId: "11111111-1111-4111-8111-111111111111",
      plannedRuns: 8,
      completedRuns: 0,
      failedRuns: 0,
      currentStage: "queued" as const,
      currentPromptId: null,
      message: "Queued",
      updatedAt: new Date().toISOString(),
    };

    const results = await Promise.allSettled([
      queueVisibilityBenchmark(project, progress, token),
      queueVisibilityBenchmark(project, progress, token),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.any(VisibilityBenchmarkConflictError),
    });
  });
});
