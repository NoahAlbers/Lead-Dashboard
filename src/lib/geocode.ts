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
const TIMEOUT_MS = 3000;

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

interface NominatimHit {
  lat?: string;
  lon?: string;
  display_name?: string;
}

/**
 * Coordinates for a US street address, or null when we cannot place it.
 * Never throws, and never takes longer than TIMEOUT_MS.
 */
export async function geocodeAddress(address: string | null | undefined): Promise<GeocodeResult | null> {
  const query = (address ?? "").trim();
  // A bare city or a stray number is not worth a request.
  if (query.length < 8) return null;

  const base = process.env.GEOCODE_URL || DEFAULT_ENDPOINT;
  const key = process.env.GEOCODE_KEY;
  const url =
    `${base}?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(query)}` +
    (key ? `&key=${encodeURIComponent(key)}` : "");

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
    if (!res.ok) return null;

    const data = (await res.json()) as NominatimHit[] | unknown;
    if (!Array.isArray(data) || data.length === 0) return null;

    const hit = data[0] as NominatimHit;
    const lat = Number.parseFloat(hit.lat ?? "");
    const lng = Number.parseFloat(hit.lon ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    const displayName = (hit.display_name ?? "").trim() || query;
    return { lat, lng, displayName: displayName.slice(0, 300) };
  } catch {
    return null;
  }
}
