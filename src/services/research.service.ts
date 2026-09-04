// Lightweight automated research: fetch the lead's company website and pull
// out what a person would grab in the first 30 seconds — the site title and
// description, and every social/profile link the homepage points at. Findings
// are stored on the lead timeline so they survive reloads and are visible to
// the whole team. Runs automatically at ingestion when a website is provided,
// and on demand from the lead page.

import { prisma } from "@/lib/db";
import { geocodeAddress } from "@/lib/geocode";
import { fetchHomepage, fetchPage } from "@/lib/site-fetch";
import {
  logoCandidates,
  manifestIcons,
  manifestUrl,
  imageLoads,
  type LogoCandidate,
} from "@/lib/site-logo";
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
  addressFrom?: string | null;
  logoUrl?: string | null;
  logoSource?: string | null;
  logoSize?: number | null;
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

// Sites write the state either way, and a site that spells it out was being
// skipped entirely.
const STATE_NAMES = Object.values(STATE_ABBREV_TO_NAME)
  .sort((a, b) => b.length - a.length)
  .join("|");

// What sits between the street line and the city varies with the markup: a
// comma when it was written inline, a pipe or a bullet in a footer, or nothing
// at all when the two were separate lines on the page.
const LINE_BREAK = String.raw`\s*[,|\u2022\u00b7\u2013]?\s*`;

/**
 * A fresh matcher each time it is asked for.
 *
 * This used to be one shared global regex, which is a trap: `exec` leaves
 * `lastIndex` pointing past the match it found, and `matchAll` starts from
 * whatever `lastIndex` it inherits. One site with an embedded map would leave
 * the offset set and the next site parsed in the same process would silently
 * skip the beginning of its own page.
 */
const textAddressPattern = () => new RegExp(
  // number, up to a few street words, then a street type
  String.raw`(\d{1,6}[A-Za-z]?\s+(?:[A-Za-z0-9.'\-]+\s+){0,4}(?:${STREET_SUFFIX})\b\.?` +
    // an optional suite or unit tail
    String.raw`(?:\s*,?\s*(?:Suite|Ste\.?|Unit|Apt\.?|Bldg\.?|Floor|#)\s*[A-Za-z0-9\-]+)?)` +
    // city
    LINE_BREAK +
    String.raw`([A-Z][A-Za-z.'\-]*(?:\s+[A-Z][A-Za-z.'\-]+){0,3})` +
    // state, abbreviated or spelled out, then the ZIP
    LINE_BREAK +
    String.raw`(${STATE_NAMES}|[A-Z]{2})\s*,?\s+(\d{5})(?:-\d{4})?\b`,
  "g",
);

const STATE_NAME_TO_CODE = new Map(
  Object.entries(STATE_ABBREV_TO_NAME).map(([code, name]) => [name.toLowerCase(), code]),
);

/** "PA" and "Pennsylvania" both come back as "PA"; anything else comes back null. */
function normaliseState(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (STATE_CODES.has(trimmed.toUpperCase()) && trimmed.length === 2) return trimmed.toUpperCase();
  return STATE_NAME_TO_CODE.get(trimmed.toLowerCase()) ?? null;
}

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
  return (
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(?:footer|address)\b[^>]*>/gi, " \u0001 ")
      // An address in markup is nearly always several lines, and stripping the
      // tags used to run them together: "219 N. Pitt Street Carlisle, PA 17013"
      // is not something the pattern can read. A line break between two lines
      // of an address is a comma when the address is written out, so that is
      // what it becomes here.
      .replace(/<br\s*\/?>/gi, ", ")
      .replace(/<\/(?:p|div|li|td|th|h[1-6]|address|span|section)\s*>/gi, ", ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/\s+/g, " ")
      // The substitutions above leave runs of commas wherever the markup was
      // nested, which the pattern would trip over.
      .replace(/\s*,(?:\s*,)+/g, ", ")
      .replace(/\s+,/g, ",")
  );
}

function fromPlainText(html: string): AddressParts | null {
  const text = toVisibleText(html);
  let best: { parts: AddressParts; score: number } | null = null;

  for (const m of text.matchAll(textAddressPattern())) {
    const region = normaliseState(m[3]);
    if (!region) continue;

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

/**
 * Yoast and most WordPress business themes publish the address as Open Graph
 * business tags, which nothing else here looks at.
 */
function fromOpenGraph(html: string): AddressParts | null {
  const tag = (prop: string, max: number) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["'](?:business:contact_data:|og:)${prop}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    const alt = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:business:contact_data:|og:)${prop}["']`,
      "i",
    );
    return tidy(html.match(re)?.[1] ?? html.match(alt)?.[1], max);
  };
  const parts: AddressParts = {
    street: tag("street[_-]?address", 120),
    city: tag("locality", 80),
    region: tag("region", 40),
    postalCode: tag("postal[_-]?code", 20),
  };
  return isUsable(parts) ? parts : null;
}

/**
 * A site with a "find us" map is telling us the address in the map's own URL.
 * Google writes it as a q= parameter or inside a /place/ path, and both survive
 * being embedded in an iframe, which is where these usually live.
 */
function fromMapLink(html: string): AddressParts | null {
  const urls = [
    ...html.matchAll(/https?:\/\/(?:www\.)?google\.[a-z.]+\/maps[^"'\s<>]*/gi),
    ...html.matchAll(/https?:\/\/maps\.google\.[a-z.]+\/[^"'\s<>]*/gi),
  ].map((m) => m[0]);

  for (const raw of urls) {
    let text: string | null = null;
    const place = raw.match(/\/place\/([^/?#]+)/i);
    if (place) text = place[1];
    if (!text) {
      const q = raw.match(/[?&](?:q|daddr|destination)=([^&]+)/i);
      if (q) text = q[1];
    }
    if (!text) continue;

    let decoded: string;
    try {
      decoded = decodeURIComponent(text.replace(/\+/g, " "));
    } catch {
      continue;
    }
    // Maps writes spaces as plus signs in a path, so a place slug arrives as
    // "1535+Cogswell+St,+Rockledge,+FL+32955".
    const line = decodeEntities(decoded.replace(/\+/g, " ").replace(/\s+/g, " ")).trim();
    const parts = parseAddressLine(line);
    if (parts) return parts;
  }
  return null;
}

/** Split one written-out address into its pieces, if it looks like one. */
function parseAddressLine(line: string): AddressParts | null {
  const m = textAddressPattern().exec(line);
  if (!m) return null;
  const region = normaliseState(m[3]);
  if (!region) return null;
  const parts: AddressParts = {
    street: tidy(m[1]),
    city: tidy(m[2], 80),
    region,
    postalCode: m[4],
  };
  return isUsable(parts) ? parts : null;
}

/**
 * Pages worth a second look when the homepage says nothing. Real links come
 * first, since a site that links to /our-office knows its own layout better
 * than we do; the conventional paths are the fallback.
 */
export function contactPageUrls(html: string, pageUrl: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const add = (href: string) => {
    try {
      const url = new URL(href, pageUrl);
      // Stay on their site, and skip anything that is not a page.
      if (url.hostname.replace(/^www\./, "") !== new URL(pageUrl).hostname.replace(/^www\./, "")) return;
      url.hash = "";
      const key = url.toString();
      if (seen.has(key) || key === pageUrl) return;
      seen.add(key);
      found.push(key);
    } catch {
      // A malformed href is not worth a fuss.
    }
  };

  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
    const href = m[1];
    const label = m[2].replace(/<[^>]+>/g, " ");
    if (/contact|location|find[- ]us|visit|our[- ]office|about/i.test(`${href} ${label}`)) {
      add(href);
    }
    if (found.length >= 4) break;
  }

  for (const path of ["/contact", "/contact-us", "/contact.html", "/locations", "/about"]) {
    add(path);
  }
  return found.slice(0, 5);
}

/** The lead's street address, or null when the site never says. Never throws. */
export function extractAddress(html: string): { line: string; parts: AddressParts } | null {
  try {
    // Ordered by how much the site meant it: machine readable markup first,
    // then a map it deliberately embedded, then whatever the page says out loud.
    const parts =
      fromJsonLd(html) ??
      fromMicrodata(html) ??
      fromOpenGraph(html) ??
      fromMapLink(html) ??
      fromPlainText(html);
    if (!parts) return null;
    const line = joinAddress(parts);
    return line === "" ? null : { line, parts };
  } catch {
    // An address is a bonus, never a reason to fail the whole research run.
    return null;
  }
}

/**
 * The best square logo the site publishes, verified to actually load.
 *
 * The manifest is fetched only when the page names one, and we try at most a
 * few candidates before giving up, because a site that declares four broken
 * icons should cost us four quick requests, not forty.
 */
async function findBestLogo(html: string, pageUrl: string): Promise<LogoCandidate | null> {
  const candidates = logoCandidates(html, pageUrl);

  const manifest = manifestUrl(html, pageUrl);
  if (manifest) {
    try {
      const res = await fetch(manifest, {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: "application/manifest+json,application/json,*/*;q=0.8" },
      });
      if (res.ok) candidates.push(...manifestIcons(await res.json(), manifest));
    } catch {
      // A missing or malformed manifest just means one fewer candidate.
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  for (const candidate of candidates.slice(0, 4)) {
    if (await imageLoads(candidate.url)) return candidate;
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

  const home = await fetchHomepage(domain);
  if (!home) {
    return {
      success: false,
      error: `Couldn't reach ${domain}. The site is down, or it refused us even through the fallback reader.`,
      domain,
    };
  }
  const html = home.body;

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

  // Where they actually are. Plenty of homepages never say, and put it on a
  // contact page instead, so a homepage that comes up empty earns a short crawl
  // of the pages it links to as contact or location. We stop at the first hit.
  let found = extractAddress(html);
  let addressFrom = found ? new URL(home.url).pathname || "/" : null;

  const contactPages = home.kind === "html" ? contactPageUrls(html, home.url) : [];

  if (!found) {
    for (const url of contactPages) {
      const page = await fetchPage(url, { allowReader: false });
      if (!page) continue;
      const hit = extractAddress(page.body);
      if (hit) {
        found = hit;
        addressFrom = new URL(url).pathname || "/";
        break;
      }
    }
  }

  // Site builders like Wix, Squarespace and Duda serve a near empty shell to
  // anything that is not running JavaScript, so the address is simply not in
  // the markup we were reading. The reader renders the page first, which is the
  // only way to see it. Reserved for this point because it is slow and we have
  // already established the ordinary route found nothing.
  if (!found && home.kind === "html") {
    for (const url of [home.url, ...contactPages.slice(0, 2)]) {
      const rendered = await fetchPage(url, { allowReader: true, readerOnly: true });
      if (!rendered) continue;
      const hit = extractAddress(rendered.body);
      if (hit) {
        found = hit;
        addressFrom = `${new URL(url).pathname || "/"} (rendered)`;
        break;
      }
    }
  }

  logger.info("RESEARCH", found ? "Address found" : "No address on the site", {
    domain,
    from: addressFrom,
    pagesTried: 1 + contactPages.length,
  });

  const geo = found ? await geocodeAddress(found.line, found.parts) : null;

  // Their own square logo, if they publish one better than a favicon.
  const logo = home.kind === "html" ? await findBestLogo(html, home.url) : null;

  const payload = {
    domain,
    siteTitle,
    siteDescription,
    profiles,
    address: found?.line ?? null,
    addressParts: found?.parts ?? null,
    // Which page it came off, so an operator can go and look.
    addressFrom,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    // "area" means we could only place the town, not the building.
    geoPrecision: geo?.precision ?? null,
    logoUrl: logo?.url ?? null,
    logoSource: logo?.source ?? null,
    logoSize: logo?.size ?? null,
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
