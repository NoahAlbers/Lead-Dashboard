// Turn a street address into a point on a map.
//
// Auto research digs an address out of the lead's website; this is the step
// that makes it something we can actually draw. The lookup runs against
// OpenStreetMap's Nominatim, which is free but asks two things of us: send a
// User-Agent that says who we are, and stay under roughly one request per
// second. We stay well inside that because a lookup only happens once per
// research run, and the coordinates are written onto the lead's auto_research
// event, so the lead page redraws the map from stored data forever after.
//
// Point GEOCODE_URL at a paid provider with the same response shape (lat, lon,
// display_name) if we ever outgrow the free tier.
//
// Nothing here is allowed to matter: every failure returns null and the caller
// carries on without a map.

const DEFAULT_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "ACB-Lead-Console/1.0 (+https://www.advancedcb.app)";
const TIMEOUT_MS = 6000;

import { logger } from "@/lib/logger";

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  /** How close we got: the building itself, or only the town around it. */
  precision: "address" | "area";
}

/** The pieces of an address, when the site gave us enough to tell them apart. */
export interface GeocodeParts {
  street?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
}

interface NominatimHit {
  lat?: string;
  lon?: string;
  display_name?: string;
}

/**
 * Suite and unit numbers are not in OpenStreetMap, and including one makes
 * Nominatim return nothing at all rather than the building. Dropped here.
 *
 * The designator has to stand as its own word and be followed by something
 * with a digit in it. "fl" is deliberately not one of them: half our leads are
 * in Florida, and "FL 32955" is a state and a ZIP code, not floor 32955.
 */
export function withoutUnit(address: string): string {
  return address
    .replace(/,?\s*\b(?:suite|ste|unit|apt|apartment|floor|rm|room|bldg|building)\b\.?\s*#?\s*[\w-]*\d[\w-]*/gi, "")
    .replace(/,?\s*#\s*[\w-]*\d[\w-]*/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/(,\s*)+,/g, ",")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
}

/**
 * Coordinates for a US address, or null when we cannot place it.
 *
 * Tried in order, because the map is meant to answer "roughly where in the
 * country are these people" and a town is a far better answer than nothing:
 *
 *   1. the address broken into fields, which Nominatim handles best
 *   2. the address as one line, with any suite number removed
 *   3. the town alone
 *
 * Never throws, and never spends longer than TIMEOUT_MS on any one attempt.
 */
export async function geocodeAddress(
  address: string | null | undefined,
  parts?: GeocodeParts | null,
): Promise<GeocodeResult | null> {
  const line = withoutUnit((address ?? "").trim());
  const street = parts?.street ? withoutUnit(parts.street) : "";
  const city = (parts?.city ?? "").trim();
  const region = (parts?.region ?? "").trim();
  const postalCode = (parts?.postalCode ?? "").trim();

  if (street && (city || postalCode)) {
    const hit = await lookup({ street, city, state: region, postalcode: postalCode }, "address");
    if (hit) return hit;
  }

  // A bare city name or a stray number is not worth a request on its own.
  if (line.length >= 8) {
    const hit = await lookup({ q: line }, "address");
    if (hit) return hit;
  }

  if (city || postalCode) {
    const hit = await lookup({ city, state: region, postalcode: postalCode }, "area");
    if (hit) return hit;
  }

  logger.info("GEOCODE", "Could not place address", { address: address ?? null });
  return null;
}

async function lookup(
  fields: Record<string, string | undefined>,
  precision: GeocodeResult["precision"],
): Promise<GeocodeResult | null> {
  const base = process.env.GEOCODE_URL || DEFAULT_ENDPOINT;
  const key = process.env.GEOCODE_KEY;

  const params = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "us" });
  for (const [name, value] of Object.entries(fields)) {
    if (value && value.trim()) params.set(name, value.trim());
  }
  if (key) params.set("key", key);
  const url = `${base}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      headers: {
        // Nominatim rejects callers that do not identify themselves.
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      // Silent for the user, but an operator should be able to find out why no
      // map showed up: a blocked caller and a rate limit look identical on screen.
      logger.warn("GEOCODE", "Lookup rejected", { status: res.status, fields });
      return null;
    }

    const data = (await res.json()) as NominatimHit[] | unknown;
    if (!Array.isArray(data) || data.length === 0) return null;

    const hit = data[0] as NominatimHit;
    const lat = Number.parseFloat(hit.lat ?? "");
    const lng = Number.parseFloat(hit.lon ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    const displayName = (hit.display_name ?? "").trim();
    return { lat, lng, displayName: displayName.slice(0, 300), precision };
  } catch (err) {
    logger.warn("GEOCODE", "Lookup failed", {
      fields,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
