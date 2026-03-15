// Re-export extracted data
export { STATE_ABBREV_TO_NAME, US_STATE_PATHS } from "./us-states-extracted";
import { STATE_ABBREV_TO_NAME } from "./us-states-extracted";

// Build reverse map: full name → full name (identity), abbreviation → full name
const STATE_NAME_TO_NAME: Record<string, string> = {};
for (const [abbrev, name] of Object.entries(STATE_ABBREV_TO_NAME)) {
  STATE_NAME_TO_NAME[abbrev.toUpperCase()] = name;
  STATE_NAME_TO_NAME[name.toLowerCase()] = name;
}

/**
 * Normalize a state value to its full name.
 * Handles: "FL" → "Florida", "florida" → "Florida", "Florida" → "Florida"
 */
export function normalizeState(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Try abbreviation (uppercase)
  const byAbbrev = STATE_NAME_TO_NAME[trimmed.toUpperCase()];
  if (byAbbrev) return byAbbrev;

  // Try lowercase full name
  const byName = STATE_NAME_TO_NAME[trimmed.toLowerCase()];
  if (byName) return byName;

  // Return as-is (unknown state)
  return trimmed;
}
