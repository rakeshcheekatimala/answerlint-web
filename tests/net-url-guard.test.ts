import { describe, expect, it, vi } from "vitest";

import {
  assertPublicHttpUrl,
  assertPublicUrl,
  isPrivateIp,
  resolveHostToPublicAddresses,
  safeFetch,
  UnsafeUrlError,
} from "@/lib/net/url-guard";

const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];

describe("isPrivateIp", () => {
  it("flags loopback, private, link-local, and reserved IPv4 ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.9.9",
      "192.168.1.10",
      "169.254.169.254", // cloud metadata endpoint
      "100.64.0.1", // CGNAT
      "0.0.0.0",
      "224.0.0.1", // multicast
      "255.255.255.255",
    ]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it("allows routable public IPv4 addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34"]) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });

  it("handles IPv6 loopback, ULA, link-local, and mapped IPv4", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("::")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
  });
});

describe("assertPublicHttpUrl", () => {
  it("accepts absolute http(s) URLs", () => {
    expect(assertPublicHttpUrl("https://example.com/pricing").hostname).toBe(
      "example.com",
    );
  });

  it("rejects non-http protocols", () => {
    expect(() => assertPublicHttpUrl("ftp://example.com")).toThrow(UnsafeUrlError);
    expect(() => assertPublicHttpUrl("file:///etc/passwd")).toThrow(UnsafeUrlError);
    expect(() => assertPublicHttpUrl("not a url")).toThrow(UnsafeUrlError);
  });

  it("rejects embedded credentials", () => {
    expect(() => assertPublicHttpUrl("https://user:pass@example.com")).toThrow(
      UnsafeUrlError,
    );
  });
});

describe("resolveHostToPublicAddresses", () => {
  it("throws when any resolved address is private", async () => {
    const resolver = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ];
    await expect(
      resolveHostToPublicAddresses("rebind.example", resolver),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("throws when the host does not resolve", async () => {
    await expect(
      resolveHostToPublicAddresses("nope.example", async () => []),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("returns addresses when all are public", async () => {
    await expect(
      resolveHostToPublicAddresses("example.com", publicResolver),
    ).resolves.toEqual(["93.184.216.34"]);
  });
});

describe("assertPublicUrl", () => {
  it("rejects a syntactically valid URL that resolves to loopback", async () => {
    const resolver = async () => [{ address: "127.0.0.1", family: 4 }];
    await expect(
      assertPublicUrl("http://localhost.attacker.example", resolver),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});

describe("safeFetch", () => {
  it("does not fetch when the host resolves to a private address", async () => {
    const fetchImpl = vi.fn();
    const resolver = async () => [{ address: "169.254.169.254", family: 4 }];

    await expect(
      safeFetch("http://metadata.internal/latest/meta-data", {
        resolver,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns the response for a public host", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("<html></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    const response = await safeFetch("https://example.com", {
      resolver: publicResolver,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("blocks a redirect that points to an internal address", async () => {
    const resolver = async (hostname: string) =>
      hostname === "example.com"
        ? [{ address: "93.184.216.34", family: 4 }]
        : [{ address: "127.0.0.1", family: 4 }];

    const fetchImpl = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: "http://localhost:6379/" },
      }),
    );

    await expect(
      safeFetch("https://example.com", {
        resolver,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects responses that declare an oversized content-length", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("body", {
        status: 200,
        headers: { "content-length": String(50 * 1024 * 1024) },
      }),
    );

    await expect(
      safeFetch("https://example.com", {
        resolver: publicResolver,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});
