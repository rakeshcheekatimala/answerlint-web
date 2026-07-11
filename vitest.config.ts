import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "lib/reports/access.ts",
        "lib/reports/preview.ts",
        "lib/reports/redirects.ts",
        "lib/reports/tokens.ts",
        "lib/business-scan/classification.ts",
        "lib/business-scan/feature-flag.ts",
        "lib/business-scan/recommendations.ts",
        "lib/business-scan/scoring.ts",
        "lib/business-scan/validation.ts",
        "lib/net/rate-limit.ts",
        "lib/net/url-guard.ts",
        "lib/supabase/config.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname,
    },
  },
});
