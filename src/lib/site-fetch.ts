// Getting a lead's website to answer us.
//
// Plenty of small business sites sit behind a WAF, and a bare fetch with a
// stripped-down header set is exactly what those are tuned to turn away: a
// browser User-Agent with no Accept-Language and no Sec-Fetch headers behind it
// reads as a scraper, because it is one. So we send the header set a real
// browser sends, and when a site still says no we ask a second time honestly,
// naming ourselves, since some sites allow declared crawlers precisely because
// they are declared.
//
// If both are refused there is one more option: a public reader service that
// fetches the page itself and hands back its text. That also happens to solve
// a different problem, a site that renders everything in JavaScript and serves
// an empty shell to anyone who is not running a browser. What comes back is
// text rather than markup, so the structured extractors cannot use it and only
// the plain-text ones can; the caller is told which it got.
//
// Set SITE_READER_URL to point that fallback somewhere else, or to "off" to
// stop using it. Nothing here ever throws, and every path is capped in time.

import { logger } from "@/lib/logger";

const DEFAULT_READER = "https://r.jina.ai/";
const PAGE_TIMEOUT_MS = 9000;
const MAX_BYTES = 500_000;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** The headers Chrome actually sends for a top-level navigation. */
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": BROWSER_UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

/** Saying who we are, for sites that would rather allow a named crawler. */
const HONEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "ACB-Lead-Console/1.0 (+https://www.advancedcb.app; research of a submitted lead)",
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export interface FetchedPage {
  /** Markup, or plain text when the reader fallback answered. */
  body: string;
  /** Where it actually came from, after redirects. */
  url: string;
  /** "html" can be parsed for structure; "text" can only be read. */
  kind: "html" | "text";
}

/** Statuses worth asking again for. A 404 means the page is simply not there. */
function worthRetrying(status: number): boolean {
  return status === 403 || status === 401 || status === 406 || status === 429 || status >= 500;
}

export function isPublicHostname(domain: string): boolean {
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return false;
  if (/(^|\.)(localhost|local|internal|test|invalid|example)$/i.test(domain)) return false;
  return true;
}

async function attempt(url: string, headers: Record<string, string>): Promise<FetchedPage | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      headers,
    });
    if (!res.ok) {
      // Worth knowing the difference later: a 403 is a door being held shut,
      // a 404 is a page that was never there.
      if (worthRetrying(res.status)) {
        logger.info("FETCHSITE", "Refused", { url, status: res.status });
      }
      return null;
    }
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html") && !type.includes("text/plain")) return null;
    const text = await res.text();
    if (text.trim().length === 0) return null;
    return { body: text.slice(0, MAX_BYTES), url: res.url || url, kind: "html" };
  } catch {
    return null;
  }
}

async function viaReader(url: string): Promise<FetchedPage | null> {
  const base = process.env.SITE_READER_URL ?? DEFAULT_READER;
  if (!base || base.toLowerCase() === "off") return null;
  try {
    const res = await fetch(`${base}${url}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS + 6000),
      headers: {
        "User-Agent": HONEST_HEADERS["User-Agent"],
        Accept: "text/plain,*/*;q=0.8",
        ...(process.env.SITE_READER_KEY
          ? { Authorization: `Bearer ${process.env.SITE_READER_KEY}` }
          : {}),
      },
    });
    if (!res.ok) {
      logger.info("FETCHSITE", "Reader refused", { url, status: res.status });
      return null;
    }
    const text = await res.text();
    if (text.trim().length < 40) return null;
    return { body: text.slice(0, MAX_BYTES), url, kind: "text" };
  } catch (err) {
    logger.info("FETCHSITE", "Reader failed", {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * One page from a lead's site, tried every way we reasonably can.
 *
 * `allowReader` is off for the extra pages we crawl out of curiosity, so a
 * blocked site costs one slow fallback rather than several.
 */
export async function fetchPage(
  url: string,
  {
    allowReader = true,
    readerOnly = false,
  }: { allowReader?: boolean; readerOnly?: boolean } = {},
): Promise<FetchedPage | null> {
  // readerOnly is for a page we have already fetched as markup and found
  // wanting: asking the same server the same question again would only get the
  // same empty shell back.
  if (readerOnly) return allowReader ? viaReader(url) : null;

  const asBrowser = await attempt(url, BROWSER_HEADERS);
  if (asBrowser) return asBrowser;

  const asOurselves = await attempt(url, HONEST_HEADERS);
  if (asOurselves) return asOurselves;

  if (!allowReader) return null;
  return viaReader(url);
}

/**
 * A lead's homepage. Tries the bare domain and the www form, and http last,
 * since a site that only answers on http is old rather than absent.
 */
export async function fetchHomepage(domain: string): Promise<FetchedPage | null> {
  if (!isPublicHostname(domain)) return null;

  const bare = domain.replace(/^www\./i, "");
  const candidates = [
    `https://${domain}`,
    `https://www.${bare}`,
    `https://${bare}`,
    `http://${domain}`,
  ];
  const seen = new Set<string>();

  for (const url of candidates) {
    if (seen.has(url)) continue;
    seen.add(url);
    const page = await attempt(url, BROWSER_HEADERS);
    if (page) return page;
  }
  // Every address refused us as a browser. Ask once more as ourselves, then
  // fall back to the reader.
  const honest = await attempt(`https://${domain}`, HONEST_HEADERS);
  if (honest) return honest;

  const read = await viaReader(`https://${domain}`);
  if (read) {
    logger.info("FETCHSITE", "Read through the fallback reader", { domain });
    return read;
  }
  logger.info("FETCHSITE", "Site would not answer", { domain });
  return null;
}
