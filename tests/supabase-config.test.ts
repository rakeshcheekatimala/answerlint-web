import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function loadConfig() {
  vi.resetModules();
  return import("@/lib/supabase/config");
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe("Supabase config", () => {
  it("detects browser and admin configuration separately", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable";
    delete process.env.SUPABASE_SECRET_KEY;
    const config = await loadConfig();

    expect(config.isSupabaseConfigured()).toBe(true);
    expect(config.isSupabaseAdminConfigured()).toBe(false);

    process.env.SUPABASE_SECRET_KEY = "service-role";
    expect(config.isSupabaseAdminConfigured()).toBe(true);
  });

  it("supports the legacy anon key name as a fallback", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    const config = await loadConfig();

    expect(config.getSupabasePublishableKey()).toBe("anon");
    expect(config.requireSupabaseBrowserConfig()).toEqual({
      url: "https://project.supabase.co",
      key: "anon",
    });
  });

  it("throws actionable errors when browser config is incomplete", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const config = await loadConfig();

    expect(() => config.requireSupabaseBrowserConfig()).toThrow(
      "Supabase is not configured.",
    );
  });

  it("throws actionable errors when admin config is incomplete", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const config = await loadConfig();

    expect(() => config.requireSupabaseAdminConfig()).toThrow(
      "Supabase admin access is not configured.",
    );
  });
});
