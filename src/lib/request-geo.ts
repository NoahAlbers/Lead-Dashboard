// Server-side visitor geolocation from Vercel's edge headers. Used as a
// fallback when the form's own IP lookup didn't finish before the visitor
// submitted (or was blocked by an ad blocker), so every lead still carries an
// IP, timezone, and estimated location. Internal eyes only — never emailed.

export interface ServerGeo {
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  timezone: string | null;
}

function decode(v: string | null): string | null {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export function serverGeoFromHeaders(headers: Headers): ServerGeo | null {
  const ip =
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const city = decode(headers.get("x-vercel-ip-city"));
  const region = decode(headers.get("x-vercel-ip-country-region"));
  const country = decode(headers.get("x-vercel-ip-country"));
  const timezone = decode(headers.get("x-vercel-ip-timezone"));
  if (!ip && !city && !timezone) return null;
  return { ip, city, region, country, timezone };
}

/** Stamp server geo into the payload's metadata so it rides along in rawPayload. */
export function attachServerGeo(body: Record<string, unknown>, headers: Headers): void {
  const geo = serverGeoFromHeaders(headers);
  if (!geo) return;
  const meta = (body.metadata && typeof body.metadata === "object"
    ? (body.metadata as Record<string, unknown>)
    : {});
  body.metadata = { ...meta, server_geo: geo };
}

/** "City, Region, Country (IP: x.x.x.x)" in the same shape the form produces. */
export function formatServerGeo(geo: ServerGeo): string | null {
  const place = [geo.city, geo.region, geo.country].filter(Boolean).join(", ");
  if (!place && !geo.ip) return null;
  if (!place) return `(IP: ${geo.ip})`;
  return geo.ip ? `${place} (IP: ${geo.ip})` : place;
}
