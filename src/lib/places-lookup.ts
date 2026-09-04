// Asking a business directory where a company is, when their own site never says.
//
// Measured against real leads, most small property managers publish no street
// address anywhere on their website: not in markup, not on a contact page, not
// even once the page has been rendered. There is nothing left to parse. What
// those companies do have is a Google Business Profile, because that is how
// customers find them, and it carries the address they never put on the site.
//
// This is the last rung of the ladder and the only one that costs money. It is
// off unless PLACES_API_KEY is set, and it only runs after every free route has
// come up empty, so it is one call per lead at most.
//
// Cost, so nobody has to go and look it up: Google's Text Search bills on the
// Pro tier, which is free for the first 5,000 calls a month and $32 per
// thousand after that. At roughly thirty leads a day this never leaves the free
// allowance.
//
// The fields asked for below are deliberately all Pro tier. Adding websiteUri
// would let us confirm a match against the domain we already know, which is
// stronger than matching on the name, but it moves the call to the Enterprise
// tier where only the first 1,000 a month are free.

import { logger } from "@/lib/logger";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const TIMEOUT_MS = 6000;

export interface PlaceMatch {
  street: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  formatted: string;
  lat: number | null;
  lng: number | null;
}

interface PlacesComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface PlacesResult {
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: PlacesComponent[];
  location?: { latitude?: number; longitude?: number };
}

/** Letters and digits only, lowercased, so "R.C.A. Realty, LLC" meets "rca realty". */
function squash(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(inc|llc|l\.l\.c|ltd|co|corp|company|group|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Is this result plausibly the company we asked about?
 *
 * Text Search always returns its best guess, so a company with no listing comes
 * back as some other business with a similar name in the same town. Without a
 * check like this we would confidently show a rep the wrong building.
 */
function namesAgree(asked: string, got: string): boolean {
  const a = squash(asked);
  const b = squash(got);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function component(components: PlacesComponent[], type: string, short = false): string | null {
  const hit = components.find((c) => c.types?.includes(type));
  const value = short ? hit?.shortText ?? hit?.longText : hit?.longText;
  return value?.trim() || null;
}

/**
 * The company's address according to Google, or null when there is no key, no
 * confident match, or anything at all goes wrong. Never throws.
 */
export async function findPlaceAddress(
  companyName: string | null | undefined,
  hint: { city?: string | null; region?: string | null } = {},
): Promise<PlaceMatch | null> {
  const key = process.env.PLACES_API_KEY;
  const name = (companyName ?? "").trim();
  if (!key || name.length < 3) return null;

  // The town narrows a common name to the right one. Without it, "Urban
  // Equities" could be any of a dozen firms.
  const where = [hint.city, hint.region].filter(Boolean).join(", ");
  const query = where ? `${name}, ${where}` : name;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.addressComponents,places.location",
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 3,
        regionCode: "US",
      }),
    });

    if (!res.ok) {
      logger.warn("PLACES", "Lookup rejected", { status: res.status, query });
      return null;
    }

    const data = (await res.json()) as { places?: PlacesResult[] };
    const places = data.places ?? [];
    if (places.length === 0) return null;

    const match = places.find((p) => namesAgree(name, p.displayName?.text ?? ""));
    if (!match) {
      logger.info("PLACES", "No result matched the company name", {
        query,
        returned: places.map((p) => p.displayName?.text).filter(Boolean),
      });
      return null;
    }

    const components = match.addressComponents ?? [];
    const streetNumber = component(components, "street_number");
    const route = component(components, "route");
    const street = [streetNumber, route].filter(Boolean).join(" ") || null;

    // A listing with no street number is a town centre pin, which we already
    // get for free from geocoding and do not need to pay for.
    if (!street) return null;

    return {
      street,
      city: component(components, "locality") ?? component(components, "postal_town"),
      region: component(components, "administrative_area_level_1", true),
      postalCode: component(components, "postal_code"),
      formatted: (match.formattedAddress ?? "").replace(/, USA$/, ""),
      lat: match.location?.latitude ?? null,
      lng: match.location?.longitude ?? null,
    };
  } catch (err) {
    logger.warn("PLACES", "Lookup failed", {
      query,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
