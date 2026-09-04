// Finding a company's square logo on their own website.
//
// A favicon service gives you a 32 pixel icon stretched to whatever size you
// asked for, which looks like exactly that next to a lead's name. Sites
// generally publish something far better and nobody asks them for it:
//
//   - the web app manifest lists icons with real sizes, often 512 square
//   - apple-touch-icon is 180 square by convention and always square
//   - JSON-LD Organization.logo is the logo the company itself declares
//   - msapplication-TileImage is square by definition
//   - a declared <link rel="icon"> may be an SVG, which is any size you like
//
// So we read all of them, rank by how big and how square each is likely to be,
// and check that the winner actually loads before believing it. Anything that
// fails falls through to the favicon service, which is where we started.
//
// Nothing here throws, and a missing logo is never an error.

const ICON_TIMEOUT_MS = 5000;

export interface LogoCandidate {
  url: string;
  /** Where it was declared, kept so the lead page can say what it found. */
  source: string;
  /** Longest declared edge in pixels, or null when the site did not say. */
  size: number | null;
  score: number;
}

/** Absolute URL for a src that may be relative, protocol relative, or absolute. */
function absolute(src: string, pageUrl: string): string | null {
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;
  try {
    return new URL(trimmed, pageUrl).toString();
  } catch {
    return null;
  }
}

/** "180x180" or "any" or "16x16 32x32" -> the largest edge mentioned. */
function largestEdge(sizes: string | null | undefined): number | null {
  if (!sizes) return null;
  if (/\bany\b/i.test(sizes)) return 1024; // an SVG, effectively unlimited
  let best: number | null = null;
  for (const m of sizes.matchAll(/(\d{2,4})\s*[x×]\s*(\d{2,4})/gi)) {
    const edge = Math.max(Number(m[1]), Number(m[2]));
    if (best === null || edge > best) best = edge;
  }
  return best;
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? m[1] : null;
}

/** An .ico is almost always the small legacy icon; an .svg scales forever. */
function formatBonus(url: string): number {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".svg")) return 60;
  if (path.endsWith(".png") || path.endsWith(".webp")) return 20;
  if (path.endsWith(".ico")) return -40;
  return 0;
}

function push(
  out: LogoCandidate[],
  url: string | null,
  source: string,
  size: number | null,
  base: number,
) {
  if (!url) return;
  if (out.some((c) => c.url === url)) return;
  out.push({ url, source, size, score: base + (size ?? 0) / 8 + formatBonus(url) });
}

/** Every square-logo candidate the page declares, best first. */
export function logoCandidates(html: string, pageUrl: string): LogoCandidate[] {
  const out: LogoCandidate[] = [];

  // What the company says its own logo is. Ranked top because it is the only
  // one that is a logo rather than an icon.
  for (const block of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const logo = findLogo(JSON.parse(block[1] ?? ""));
      if (logo) push(out, absolute(logo, pageUrl), "schema.org logo", null, 200);
    } catch {
      // Hand written JSON-LD is broken often enough to just skip.
    }
  }

  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    const href = attr(tag, "href");
    if (!href) continue;
    const size = largestEdge(attr(tag, "sizes"));

    if (rel.includes("apple-touch-icon")) {
      // 180 square by convention, and never the tiny legacy icon.
      push(out, absolute(href, pageUrl), "apple touch icon", size ?? 180, 150);
    } else if (rel.split(/\s+/).includes("icon") || rel.includes("shortcut icon")) {
      push(out, absolute(href, pageUrl), "declared icon", size, 90);
    } else if (rel.includes("mask-icon")) {
      push(out, absolute(href, pageUrl), "mask icon", 1024, 70);
    }
  }

  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const name = (attr(tag, "name") ?? attr(tag, "property") ?? "").toLowerCase();
    const content = attr(tag, "content");
    if (!content) continue;
    if (name === "msapplication-tileimage") {
      push(out, absolute(content, pageUrl), "tile image", 144, 120);
    } else if (name === "og:image" || name === "twitter:image") {
      // A share image is whatever the site wanted in a Facebook card: sometimes
      // the logo, more often a hero photo, a staff portrait, or a wide white
      // wordmark that disappears on a pale card. None of those belong in a
      // 14 pixel square, so we take one only when the file says what it is.
      if (/\b(logo|icon|mark|brand|badge)\b/i.test(decodeURIComponent(content))) {
        push(out, absolute(content, pageUrl), "share image", null, 40);
      }
    }
  }

  return out.sort((a, b) => b.score - a.score);
}

/** The manifest's own icons, which are the largest squares a site publishes. */
export function manifestUrl(html: string, pageUrl: string): string | null {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (attr(m[0], "rel") ?? "").toLowerCase();
    if (!rel.includes("manifest")) continue;
    const href = attr(m[0], "href");
    if (href) return absolute(href, pageUrl);
  }
  return null;
}

export function manifestIcons(json: unknown, manifestHref: string): LogoCandidate[] {
  const out: LogoCandidate[] = [];
  const icons = (json as { icons?: unknown })?.icons;
  if (!Array.isArray(icons)) return out;
  for (const icon of icons) {
    const entry = icon as { src?: unknown; sizes?: unknown; purpose?: unknown };
    if (typeof entry.src !== "string") continue;
    // A maskable icon is padded and cropped by the OS, so it looks wrong on a
    // page. Prefer any plain one.
    const maskable = typeof entry.purpose === "string" && entry.purpose.includes("maskable");
    const size = largestEdge(typeof entry.sizes === "string" ? entry.sizes : null);
    push(
      out,
      absolute(entry.src, manifestHref),
      "web app manifest",
      size,
      maskable ? 100 : 170,
    );
  }
  return out.sort((a, b) => b.score - a.score);
}

function findLogo(node: unknown, depth = 0): string | null {
  if (depth > 8 || node === null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findLogo(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const logo = obj.logo;
  if (typeof logo === "string") return logo;
  if (logo && typeof logo === "object") {
    const url = (logo as Record<string, unknown>).url ?? (logo as Record<string, unknown>).contentUrl;
    if (typeof url === "string") return url;
  }
  for (const value of Object.values(obj)) {
    const hit = findLogo(value, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/** Does this URL actually serve an image? A declared icon is often a 404. */
export async function imageLoads(url: string): Promise<boolean> {
  const check = async (method: "HEAD" | "GET") => {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(ICON_TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) return false;
    const type = res.headers.get("content-type") ?? "";
    if (type && !type.startsWith("image/")) return false;
    const length = Number(res.headers.get("content-length") ?? "0");
    // A handful of bytes is a tracking pixel or an error page, not a logo.
    return length === 0 || length > 200;
  };
  try {
    if (await check("HEAD")) return true;
  } catch {
    // Some servers refuse HEAD outright. Fall through and ask properly.
  }
  try {
    return await check("GET");
  } catch {
    return false;
  }
}
