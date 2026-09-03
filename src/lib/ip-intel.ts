// Is this visitor on a VPN, a phone network, or a datacenter?
//
// Knowing that before picking up the phone is useful: a datacenter address is
// usually a bot or a scraper, a VPN often means the location shown is wrong,
// and a mobile network explains a flaky session. The lookup runs against
// ip-api.com, whose free endpoint is plain HTTP and rate limited to about 45
// calls a minute per caller. Point IP_LOOKUP_URL at their pro endpoint (or any
// service with the same field names) to lift both limits.
//
// Nothing here is allowed to matter: every failure returns null and the caller
// carries on without an IP type.

const DEFAULT_ENDPOINT = "http://ip-api.com/json";
const FIELDS = "status,message,mobile,proxy,hosting,isp,org,query";
const TIMEOUT_MS = 2500;

export type IpType =
  | "VPN or proxy"
  | "Hosting or datacenter"
  | "Mobile network"
  | "Residential or business";

export interface IpIntel {
  type: IpType;
  isp: string | null;
}

interface IpApiResponse {
  status?: string;
  message?: string;
  mobile?: boolean;
  proxy?: boolean;
  hosting?: boolean;
  isp?: string;
  org?: string;
}

/** Addresses that never leave the building, so never worth asking about. */
function isPrivate(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith("fc") ||
    ip.startsWith("fd")
  );
}

function classify(data: IpApiResponse): IpType {
  // A proxy flag is the most useful thing to say out loud, then a datacenter,
  // then a phone network. Anything else is somebody at home or at work.
  if (data.proxy) return "VPN or proxy";
  if (data.hosting) return "Hosting or datacenter";
  if (data.mobile) return "Mobile network";
  return "Residential or business";
}

/**
 * What kind of connection an address belongs to, or null when we cannot say.
 * Never throws, and never takes longer than TIMEOUT_MS.
 */
export async function lookupIpIntel(ip: string | null | undefined): Promise<IpIntel | null> {
  const address = (ip ?? "").trim();
  if (!address || isPrivate(address)) return null;

  const base = process.env.IP_LOOKUP_URL || DEFAULT_ENDPOINT;
  const key = process.env.IP_LOOKUP_KEY;
  const url = `${base}/${encodeURIComponent(address)}?fields=${FIELDS}${key ? `&key=${encodeURIComponent(key)}` : ""}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as IpApiResponse;
    // "fail" covers private ranges, reserved blocks and quota problems.
    if (data.status !== "success") return null;
    const isp = (data.isp || data.org || "").trim();
    return { type: classify(data), isp: isp === "" ? null : isp.slice(0, 120) };
  } catch {
    return null;
  }
}

/** Short label plus a hint of why it matters, for tooltips. */
export const IP_TYPE_HINTS: Record<IpType, string> = {
  "VPN or proxy": "Behind a VPN or proxy, so the location shown may not be where they are",
  "Hosting or datacenter": "A datacenter address, which usually means a bot or a scraper rather than a person",
  "Mobile network": "On a phone network, which explains a patchy session",
  "Residential or business": "An ordinary home or office connection",
};
