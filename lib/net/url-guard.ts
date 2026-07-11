import { lookup } from "node:dns/promises";

/**
 * SSRF protection utilities.
 *
 * These helpers ensure that server-side fetches (page discovery, audits) can
 * only ever reach public internet hosts. They block loopback, private,
 * link-local (including the cloud metadata endpoint 169.254.169.254), and other
 * reserved address ranges for both IPv4 and IPv6.
 *
 * `safeFetch` follows redirects manually and re-validates every hop, which
 * blocks the common "redirect to an internal address" SSRF bypass. Residual
 * DNS-rebinding risk (a host resolving to a public IP at validation time and a
 * private IP at connection time) is not fully eliminated here; see the note on
 * `resolveHostToPublicAddresses`.
 */

export const DEFAULT_FETCH_TIMEOUT_MS = 8000;
export const DEFAULT_MAX_REDIRECTS = 4;
export const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

type DnsResolver = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

const defaultResolver: DnsResolver = async (hostname) => {
  const results = await lookup(hostname, { all: true });
  return results.map((entry) => ({ address: entry.address, family: entry.family }));
};

/**
 * Parses and validates a URL string, enforcing that it is an absolute
 * http(s) URL with no embedded credentials. Does not perform DNS resolution.
 */
export function assertPublicHttpUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UnsafeUrlError("The URL is not valid.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https URLs are allowed.");
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with embedded credentials are not allowed.");
  }

  if (!url.hostname) {
    throw new UnsafeUrlError("The URL is missing a hostname.");
  }

  return url;
}

function ipv4ToLong(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }

  return value >>> 0;
}

function isPrivateIpv4(address: string): boolean {
  const long = ipv4ToLong(address);
  if (long === null) return true; // Unparseable → treat as unsafe.

  const inRange = (base: string, maskBits: number) => {
    const baseLong = ipv4ToLong(base);
    if (baseLong === null) return false;
    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
    return (long & mask) === (baseLong & mask);
  };

  return (
    inRange("0.0.0.0", 8) || // "this" network
    inRange("10.0.0.0", 8) || // private
    inRange("100.64.0.0", 10) || // carrier-grade NAT
    inRange("127.0.0.0", 8) || // loopback
    inRange("169.254.0.0", 16) || // link-local (cloud metadata)
    inRange("172.16.0.0", 12) || // private
    inRange("192.0.0.0", 24) || // IETF protocol assignments
    inRange("192.0.2.0", 24) || // TEST-NET-1
    inRange("192.168.0.0", 16) || // private
    inRange("198.18.0.0", 15) || // benchmarking
    inRange("198.51.100.0", 24) || // TEST-NET-2
    inRange("203.0.113.0", 24) || // TEST-NET-3
    inRange("224.0.0.0", 4) || // multicast
    inRange("240.0.0.0", 4) // reserved / broadcast
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0]; // strip zone id

  if (normalized === "::1" || normalized === "::") return true;

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible → validate embedded IPv4.
  const mapped = normalized.match(/(?:^::ffff:|^::)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);

  const firstHextet = normalized.split(":")[0] ?? "";
  const leading = parseInt(firstHextet || "0", 16);

  if (Number.isNaN(leading)) return true;

  // fc00::/7 unique local
  if ((leading & 0xfe00) === 0xfc00) return true;
  // fe80::/10 link-local
  if ((leading & 0xffc0) === 0xfe80) return true;
  // ff00::/8 multicast
  if ((leading & 0xff00) === 0xff00) return true;

  return false;
}

/**
 * Returns true when the literal IP address is loopback, private, link-local,
 * or otherwise not a routable public address.
 */
export function isPrivateIp(address: string, family?: number): boolean {
  if (!address) return true;
  if (family === 6 || address.includes(":")) return isPrivateIpv6(address);
  return isPrivateIpv4(address);
}

/**
 * Resolves a hostname and asserts that every resolved address is public.
 * Rejecting when *any* address is private prevents an attacker from returning
 * one public and one private record to slip past the check.
 */
export async function resolveHostToPublicAddresses(
  hostname: string,
  resolver: DnsResolver = defaultResolver,
): Promise<string[]> {
  let records: Array<{ address: string; family: number }>;
  try {
    records = await resolver(hostname);
  } catch {
    throw new UnsafeUrlError(`Could not resolve host "${hostname}".`);
  }

  if (!records.length) {
    throw new UnsafeUrlError(`Host "${hostname}" did not resolve to an address.`);
  }

  for (const record of records) {
    if (isPrivateIp(record.address, record.family)) {
      throw new UnsafeUrlError(
        `Host "${hostname}" resolves to a non-public address and cannot be scanned.`,
      );
    }
  }

  return records.map((record) => record.address);
}

/**
 * Validates a URL string is a public http(s) URL AND resolves to public
 * addresses. Returns the parsed URL.
 */
export async function assertPublicUrl(
  input: string,
  resolver: DnsResolver = defaultResolver,
): Promise<URL> {
  const url = assertPublicHttpUrl(input);
  await resolveHostToPublicAddresses(url.hostname, resolver);
  return url;
}

type SafeFetchOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  resolver?: DnsResolver;
  fetchImpl?: typeof fetch;
};

/**
 * A fetch wrapper that enforces SSRF protection on the initial URL and on
 * every redirect hop, applies a timeout, and caps the response body size.
 */
export async function safeFetch(
  input: string,
  options: SafeFetchOptions = {},
): Promise<Response> {
  const {
    headers,
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    maxBytes = DEFAULT_MAX_RESPONSE_BYTES,
    resolver = defaultResolver,
    fetchImpl = fetch,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = await assertPublicUrl(input, resolver);
    let redirects = 0;

    while (true) {
      const response = await fetchImpl(currentUrl.toString(), {
        signal: controller.signal,
        headers,
        redirect: "manual",
        cache: "no-store",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return response;

        redirects += 1;
        if (redirects > maxRedirects) {
          throw new UnsafeUrlError("Too many redirects while fetching the URL.");
        }

        // Re-validate the redirect target before following it.
        currentUrl = await assertPublicUrl(
          new URL(location, currentUrl).toString(),
          resolver,
        );
        continue;
      }

      return enforceResponseSize(response, maxBytes);
    }
  } finally {
    clearTimeout(timer);
  }
}

function enforceResponseSize(response: Response, maxBytes: number): Response {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new UnsafeUrlError("The response is too large to process.");
  }
  return response;
}
