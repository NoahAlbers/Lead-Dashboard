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
};

export const NEUTRAL = "#8889A0";
