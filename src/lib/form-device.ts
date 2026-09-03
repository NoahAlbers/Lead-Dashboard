// The intake form reports its visitor context as one string:
//   "Desktop / Chrome / Windows"  (device / browser / os)
// Older rows may hold just a device word, or nothing at all. These helpers are
// the single place that string gets taken apart, so the live monitor and the
// conversion breakdowns always label things the same way.

export interface DeviceParts {
  device: string; // Desktop | Mobile | Tablet | Unknown
  browser: string; // Chrome | Safari | Firefox | Edge | Unknown
  os: string; // Windows | macOS | iOS | Android | Linux | Unknown
}

const UNKNOWN: DeviceParts = { device: "Unknown", browser: "Unknown", os: "Unknown" };

function clean(part: string | undefined): string {
  const v = (part ?? "").trim();
  if (!v || v.toLowerCase() === "unknown") return "Unknown";
  return v;
}

/** Split the form's "device / browser / os" string. Never throws. */
export function parseDeviceString(value: string | null | undefined): DeviceParts {
  if (!value) return { ...UNKNOWN };
  const bits = value.split("/").map((b) => b.trim());
  if (bits.length >= 3) {
    return { device: clean(bits[0]), browser: clean(bits[1]), os: clean(bits[2]) };
  }
  // A bare word: treat a known device name as the device, anything else as the browser.
  const only = clean(bits[0]);
  if (/^(desktop|mobile|tablet)$/i.test(only)) return { ...UNKNOWN, device: only };
  return { ...UNKNOWN, browser: only };
}

/** Best-effort device label from a raw user agent (partial rows carry no parsed string). */
export function deviceFromUserAgent(ua: string | null | undefined): DeviceParts {
  if (!ua) return { ...UNKNOWN };
  const device = /iPad|Tablet/i.test(ua)
    ? "Tablet"
    : /iPhone|Android.*Mobile|Mobile/i.test(ua)
      ? "Mobile"
      : /Windows|Macintosh|Linux|CrOS/i.test(ua)
        ? "Desktop"
        : "Unknown";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\/|Opera/i.test(ua)
      ? "Opera"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Firefox\//i.test(ua)
          ? "Firefox"
          : /Safari\//i.test(ua)
            ? "Safari"
            : "Unknown";
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/i.test(ua)
      ? "macOS"
      : /Android/i.test(ua)
        ? "Android"
        : /iPhone|iPad|iOS/i.test(ua)
          ? "iOS"
          : /Linux|CrOS/i.test(ua)
            ? "Linux"
            : "Unknown";
  return { device, browser, os };
}

/** "Orlando, FL" or "Orlando, FL, CA" style label from the stored geo columns. */
export function geoLabel(city?: string | null, region?: string | null, country?: string | null): string | null {
  const parts = [city, region, country && country !== "US" ? country : null].filter(
    (p): p is string => !!p && p.trim() !== ""
  );
  return parts.length ? parts.join(", ") : null;
}
