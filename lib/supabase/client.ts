"use client";

import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseBrowserConfig } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const { url, key } = requireSupabaseBrowserConfig();
  return createBrowserClient(url, key);
}
