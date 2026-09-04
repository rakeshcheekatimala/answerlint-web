import { Inngest } from "inngest";

/** Durable work stays separate from request handlers and provider adapters. */
export const inngest = new Inngest({
  id: "answerlint",
  isDev: process.env.INNGEST_DEV === "1",
  checkpointing: { maxRuntime: "240s", bufferedSteps: 1 },
});

export function canDispatchInngestEvents() {
  return process.env.INNGEST_DEV === "1" || Boolean(process.env.INNGEST_EVENT_KEY?.trim());
}
