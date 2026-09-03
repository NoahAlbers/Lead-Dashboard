// Lightweight automated research: fetch the lead's company website and pull
// out what a person would grab in the first 30 seconds — the site title and
// description, and every social/profile link the homepage points at. Findings
// are stored on the lead timeline so they survive reloads and are visible to
// the whole team. Runs automatically at ingestion when a website is provided,
// and on demand from the lead page.

import { prisma } from "@/lib/db";
import { geocodeAddress } from "@/lib/geocode";
import { leadWebDomain } from "@/lib/lead-domain";
import { logger } from "@/lib/logger";
import { STATE_ABBREV_TO_NAME } from "@/lib/us-states-extracted";

export interface FoundProfile {
  kind: string;
  url: string;
}

/** The pieces of a street address, whichever ones the site actually gave us. */
export interface AddressParts {
  street?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
}

export interface AutoResearchResult {
  success: boolean;
  error?: string;
  domain?: string;
  siteTitle?: string | null;
  siteDescription?: string | null;
  profiles?: FoundProfile[];
  // Everything below is best effort: plenty of sites never publish an address,
  // and geocoding can fail on its own. All of it stays optional so events
  // written before this existed still render.
  address?: string | null;
  addressParts?: AddressParts | null;
  lat?: number | null;
  lng?: number | null;
  geoPrecision?: "address" | "area" | null;
}

const PROFILE_HOSTS: Array<{ kind: string; match: RegExp }> = [
  { kind: "LinkedIn", match: /linkedin\.com\/(company|in)\/[^/?#"']+/i },
  { kind: "Facebook", match: /facebook\.com\/(?!sharer|share|plugins)[^/?#"']+/i },
  { kind: "Instagram", match: /instagram\.com\/[^/?#"']+/i },
  { kind: "X / Twitter", match: /(?:twitter|x)\.com\/(?!intent|share)[^/?#"']+/i },
  { kind: "YouTube", match: /youtube\.com\/(@|channel\/|user\/|c\/)[^/?#"']+/i },
  { kind: "Yelp", match: /yelp\.com\/biz\/[^/?#"']+/i },
  { kind: "BBB", match: /bbb\.org\/[^"'\s>]+/i },
];

function extractMeta(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["'](?:og:)?${name}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["'](?:og:)?${name}["']`,
    "i"
  );
  return html.match(re)?.[1] ?? html.match(alt)?.[1] ?? null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Address extraction
//
// Three passes, most trustworthy first. Structured data is the site telling us
// its address on purpose, so we believe it. The plain text sweep is a guess, so
// it is deliberately fussy: a real two letter state code and a real five digit
// zip, nothing found inside a script or a stylesheet, and a preference for
// matches sitting near a footer or the word "address" because that is where a
// business puts the one address that matters.
// ---------------------------------------------------------------------------

const STATE_CODES = new Set(Object.keys(STATE_ABBREV_TO_NAME));

// Left off "Suite" and "Unit" on purpose: those start a second line, they do
// not end a street.
const STREET_SUFFIX =
  "Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl|Parkway|Pkwy|Highway|Hwy|Terrace|Ter|Trail|Trl|Square|Sq|Loop|Route|Rte";

const TEXT_ADDRESS = new RegExp(
  // number, up to a few street words, then a street type
  String.raw`(\d{1,6}[A-Za-z]?\s+(?:[A-Za-z0-9.'\-]+\s+){0,4}(?:${STREET_SUFFIX})\b\.?` +
    // an optional suite or unit tail
    String.raw`(?:\s*,?\s*(?:Suite|Ste\.?|Unit|Apt\.?|Bldg\.?|#)\s*[A-Za-z0-9\-]+)?)` +
    // , city
    String.raw`\s*,\s*([A-Za-z][A-Za-z.'\-]*(?:\s+[A-Za-z.'\-]+){0,3})` +
    // , ST ZIP
    String.raw`\s*,?\s+([A-Z]{2})\s+(\d{5})(?:-\d{4})?\b`,
  "g"
);

function tidy(value: unknown, max = 120): string | null {
  if (typeof value !== "string") return null;
  const cleaned = decodeEntities(value.replace(/\s+/g, " ")).trim();
  return cleaned === "" ? null : cleaned.slice(0, max);
}

/** "12 Main St, Springfield, IL 62704" from whatever pieces we managed to get. */
function joinAddress(parts: AddressParts): string {
  const tail = [parts.region, parts.postalCode].filter(Boolean).join(" ");
  return [parts.street, parts.city, tail].filter(Boolean).join(", ").trim();
}

/** Enough of an address to be worth geocoding? A lone city is not. */
function isUsable(parts: AddressParts): boolean {
  if (!parts.street) return false;
  return Boolean(parts.city || parts.postalCode);
}

/** Walk a parsed JSON-LD blob looking for a PostalAddress, however deeply it
 * is buried. Sites nest these under Organization, LocalBusiness, @graph, or
 * plain arrays, so we just look everywhere. */
function findPostalAddress(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 8 || node === null || typeof node !== "object") return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findPostalAddress(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }

  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  const typeNames = Array.isArray(type) ? type : [type];
  const isPostal = typeNames.some((t) => typeof t === "string" && t.toLowerCase() === "postaladdress");
  if (isPostal || typeof obj.streetAddress === "string") return obj;

  for (const value of Object.values(obj)) {
    const hit = findPostalAddress(value, depth + 1);
    if (hit) return hit;
  }
  return null;
}

function fromJsonLd(html: string): AddressParts | null {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const block of blocks) {
    const body = block[1]?.trim();
    if (!body) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      // Hand written JSON-LD is broken surprisingly often. Skip it and move on.
      continue;
    }
    const found = findPostalAddress(parsed);
    if (!found) continue;
    const parts: AddressParts = {
      street: tidy(found.streetAddress),
      city: tidy(found.addressLocality, 80),
      region: tidy(found.addressRegion, 40),
      postalCode: tidy(found.postalCode, 20),
    };
    if (isUsable(parts)) return parts;
  }
  return null;
}

/** One microdata property, from a content attribute or from the element text. */
function microProp(html: string, prop: string, max: number): string | null {
  const attrFirst = new RegExp(`<[^>]*itemprop=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i");
  const contentFirst = new RegExp(`<[^>]*content=["']([^"']+)["'][^>]*itemprop=["']${prop}["']`, "i");
  const inner = new RegExp(
    `<([a-z0-9]+)[^>]*itemprop=["']${prop}["'][^>]*>([\\s\\S]{1,300}?)</\\1>`,
    "i"
  );
  const attr = html.match(attrFirst)?.[1] ?? html.match(contentFirst)?.[1];
  if (attr) return tidy(attr, max);
  const text = html.match(inner)?.[2];
  return text ? tidy(text.replace(/<[^>]+>/g, " "), max) : null;
}

function fromMicrodata(html: string): AddressParts | null {
  const parts: AddressParts = {
    street: microProp(html, "streetAddress", 120),
    city: microProp(html, "addressLocality", 80),
    region: microProp(html, "addressRegion", 40),
    postalCode: microProp(html, "postalCode", 20),
  };
  return isUsable(parts) ? parts : null;
}

/** Visible page text, with a marker left behind wherever a footer or an
 * <address> block started so we can prefer matches that live there. */
function toVisibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:footer|address)\b[^>]*>/gi, " \u0001 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ");
}

function fromPlainText(html: string): AddressParts | null {
  const text = toVisibleText(html);
  let best: { parts: AddressParts; score: number } | null = null;

  for (const m of text.matchAll(TEXT_ADDRESS)) {
    const region = m[3];
    if (!STATE_CODES.has(region)) continue;

    const parts: AddressParts = {
      street: tidy(m[1]),
      city: tidy(m[2], 80),
      region,
      postalCode: m[4],
    };
    if (!isUsable(parts)) continue;

    // A match sitting just after a footer marker, an <address> tag, or the word
    // "address" is almost always the real one. Everything else scores lower.
    const before = text.slice(Math.max(0, (m.index ?? 0) - 240), m.index ?? 0);
    const score = before.includes("\u0001") || /address/i.test(before) ? 2 : 1;

    if (!best || score > best.score) best = { parts, score };
    if (score === 2) break;
  }

  return best?.parts ?? null;
}

/** The lead's street address, or null when the site never says. Never throws. */
export function extractAddress(html: string): { line: string; parts: AddressParts } | null {
  try {
    const parts = fromJsonLd(html) ?? fromMicrodata(html) ?? fromPlainText(html);
    if (!parts) return null;
    const line = joinAddress(parts);
    return line === "" ? null : { line, parts };
  } catch {
    // An address is a bonus, never a reason to fail the whole research run.
    return null;
  }
}

async function fetchSite(domain: string): Promise<string | null> {
  // Only fetch plain public hostnames — never IPs or localhost.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) || /^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
    return null;
  }
  for (const url of [`https://${domain}`, `https://www.${domain}`]) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "";
      if (!type.includes("html")) continue;
      const text = await res.text();
      return text.slice(0, 500_000);
    } catch {
      continue;
    }
  }
  return null;
}

/** Research a lead's company site. userId is the staff member who asked, or
 * null when the pipeline ran it automatically. */
export async function runAutoResearch(leadId: string, userId: string | null): Promise<AutoResearchResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { success: false, error: "Lead not found" };

  const raw = lead.rawPayloadJson as Record<string, unknown> | null;
  const intake = (raw?._rawIntakeForm as Record<string, unknown>) ?? raw ?? {};
  const website = (intake.companyWebsite as string) || null;
  const domain = leadWebDomain(website, lead.email);

  if (!domain) {
    return {
      success: false,
      error: "No company website or business email domain to research. Their email is a personal address.",
    };
  }

  const html = await fetchSite(domain);
  if (!html) {
    return { success: false, error: `Couldn't reach ${domain}. The site may be down or blocking robots.`, domain };
  }

  const titleRaw = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1] ?? null;
  const siteTitle = titleRaw ? decodeEntities(titleRaw) : null;
  const descRaw = extractMeta(html, "description");
  const siteDescription = descRaw ? decodeEntities(descRaw).slice(0, 300) : null;

  const profiles: FoundProfile[] = [];
  const seen = new Set<string>();
  for (const { kind, match } of PROFILE_HOSTS) {
    const m = html.match(match);
    if (m) {
      let url = m[0];
      if (!url.startsWith("http")) url = `https://${url}`;
      url = url.replace(/["'>].*$/, "");
      const key = url.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        profiles.push({ kind, url });
      }
    }
  }

  // Where they actually are. We geocode once, here, and keep the coordinates on
  // the event so the lead page can draw the map without ever calling out again.
  const found = extractAddress(html);
  const geo = found ? await geocodeAddress(found.line, found.parts) : null;

  const payload = {
    domain,
    siteTitle,
    siteDescription,
    profiles,
    address: found?.line ?? null,
    addressParts: found?.parts ?? null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    // "area" means we could only place the town, not the building.
    geoPrecision: geo?.precision ?? null,
    fetchedAt: new Date().toISOString(),
    automatic: userId == null,
  };

  await prisma.leadEvent.create({
    data: {
      leadId,
      userId: userId ?? undefined,
      eventType: "auto_research",
      eventDataJson: JSON.parse(JSON.stringify(payload)),
    },
  });

  logger.info("RESEARCH", "Auto research stored", {
    leadId,
    domain,
    profiles: profiles.length,
    address: payload.address,
    mapped: payload.lat != null,
  });
  return { success: true, ...payload };
}
