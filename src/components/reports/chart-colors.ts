// Tier colors
export const TIER_COLORS: Record<string, string> = {
  "A Lead": "#16a34a",
  "B Lead": "#3D5AF1",
  "C Lead": "#eab308",
  "Poor Fit": "#ef4444",
  // Fallback for legacy tier names
  A: "#16a34a",
  B: "#3D5AF1",
  C: "#eab308",
  POOR: "#ef4444",
};

// Status colors
export const STATUS_COLORS: Record<string, string> = {
  NEW: "#3b82f6",
  REVIEWED: "#6366f1",
  QUALIFIED: "#22c55e",
  CONTACTED: "#06b6d4",
  FOLLOW_UP_NEEDED: "#f59e0b",
  REFERRED_OUT: "#a855f7",
  IMPORTED_TO_CRM: "#0891b2",
  WON: "#10b981",
  LOST: "#6b7280",
  DISQUALIFIED: "#ef4444",
  DUPLICATE: "#f97316",
  ARCHIVED: "#9ca3af",
  MERGED: "#d1d5db",
};

export const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  REVIEWED: "Reviewed",
  QUALIFIED: "Qualified",
  CONTACTED: "Contacted",
  FOLLOW_UP_NEEDED: "Follow-Up",
  REFERRED_OUT: "Referred",
  IMPORTED_TO_CRM: "In CRM",
  WON: "Won",
  LOST: "Lost",
  DISQUALIFIED: "Disqualified",
  DUPLICATE: "Duplicate",
  ARCHIVED: "Archived",
  MERGED: "Merged",
};

export const NEUTRAL = "#8889A0";

/** Darken a hex color for chart visibility by reducing lightness and boosting saturation */
export function darkenForChart(hex: string, amount = 0.25): string {
  // Parse hex to RGB
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  // RGB to HSL
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  // Darken lightness, boost saturation
  l = Math.max(0.2, l - amount);
  s = Math.min(1, s + 0.15);

  // HSL to RGB
  function hue2rgb(p: number, q: number, t: number) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  let rr: number, gg: number, bb: number;
  if (s === 0) {
    rr = gg = bb = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    rr = hue2rgb(p, q, h + 1 / 3);
    gg = hue2rgb(p, q, h);
    bb = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, "0");
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}
