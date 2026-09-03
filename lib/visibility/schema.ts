import { z } from "zod";

import {
  REVENUE_GOALS,
  VISIBILITY_SURFACES,
  type RuntimePolicy,
} from "@/lib/visibility/types";

const urlSchema = z.string().trim().url("Enter a complete http(s) URL.").max(2_048);

const competitorSchema = z
  .object({
    name: z.string().trim().max(120),
    url: z.union([urlSchema, z.literal("")]),
  })
  .superRefine((competitor, context) => {
    if (!competitor.name && !competitor.url) return;
    if (competitor.name.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["name"],
        message: "Enter a competitor name.",
      });
    }
  });

const runtimePolicySchema = z.object({
  searchMode: z.enum(["search_enabled", "model_only"]),
  freshSession: z.boolean(),
  device: z.enum(["desktop", "mobile"]),
  repeatRuns: z.number().int().min(1).max(10),
  testFrequency: z.enum(["one_time", "weekly", "monthly"]),
});

export const visibilityIntakeSchema = z.object({
  brandUrl: urlSchema,
  brandName: z.string().trim().min(2, "Enter the brand name.").max(120),
  description: z.string().trim().max(1_000),
  primaryCategory: z.string().trim().min(2, "Enter a category or product.").max(160),
  targetCustomers: z.string().trim().min(2, "Describe the target customer.").max(500),
  keyUseCases: z
    .array(z.string().trim().min(2).max(180))
    .min(1, "Add at least one key use case.")
    .max(6),
  revenueGoal: z.enum(REVENUE_GOALS),
  competitors: z.array(competitorSchema).max(8),
  markets: z
    .array(z.string().trim().regex(/^[A-Z]{2}$/, "Use a two-letter country code."))
    .min(1, "Choose at least one market.")
    .max(10),
  languages: z
    .array(z.string().trim().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/, "Use a language code."))
    .min(1, "Choose at least one language.")
    .max(10),
  surfaces: z.array(z.enum(VISIBILITY_SURFACES)).min(1).max(VISIBILITY_SURFACES.length),
  runtimePolicy: runtimePolicySchema,
});

export type VisibilityIntake = z.infer<typeof visibilityIntakeSchema>;

export const visibilityApprovalSchema = z.object({
  brandCard: z.boolean().optional(),
  topicIds: z.array(z.string().uuid()).min(1).optional(),
});

export type VisibilityApprovalInput = z.infer<typeof visibilityApprovalSchema>;

export function defaultRuntimePolicy(): RuntimePolicy {
  return {
    searchMode: "search_enabled",
    freshSession: true,
    device: "desktop",
    repeatRuns: 3,
    testFrequency: "one_time",
  };
}
