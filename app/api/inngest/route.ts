import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { runVisibilityBenchmark } from "@/lib/inngest/functions/visibility-benchmark";

export const runtime = "nodejs";
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runVisibilityBenchmark],
});
