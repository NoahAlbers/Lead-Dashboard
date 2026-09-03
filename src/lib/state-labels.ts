// Writing state names in a column that keeps getting narrower.
//
// Leads arrive with states written either way: "Maryland" from one source,
// "MD" from another. A wide column can spell them out; a narrow one cannot,
// and three spelled-out names in an 80px column just clip into nonsense. So
// the table asks this module what fits and gets abbreviations when it does not.

import { STATE_ABBREV_TO_NAME } from "@/lib/us-states-extracted";

const NAME_TO_ABBREV: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBREV_TO_NAME).map(([abbrev, name]) => [name.toUpperCase(), abbrev]),
);

/** "Maryland" and "MD" both come back as "MD". Anything unrecognised is left alone. */
export function stateAbbreviation(value: string): string {
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  if (STATE_ABBREV_TO_NAME[upper]) return upper;
  return NAME_TO_ABBREV[upper] ?? trimmed;
}

/** "MD" and "Maryland" both come back as "Maryland", for tooltips. */
export function stateFullName(value: string): string {
  const trimmed = value.trim();
  const upper = trimmed.toUpperCase();
  return STATE_ABBREV_TO_NAME[upper] ?? trimmed;
}

// Measured against the chip the table draws: 10px medium text inside px-1.5.
// Close enough to decide whether something fits, and erring narrow would only
// abbreviate a little sooner than strictly necessary.
const CHAR_PX = 6;
const CHIP_PADDING_PX = 14;
const GAP_PX = 2;

function chipWidth(text: string): number {
  return text.length * CHAR_PX + CHIP_PADDING_PX;
}

/**
 * The labels to draw for a lead's states, spelled out when there is room and
 * abbreviated once the column is squeezed.
 *
 * `columnWidth` is the column's own width; the cell's horizontal padding is
 * taken off here so callers do not have to remember it.
 */
export function fitStateLabels(
  states: string[],
  columnWidth: number,
  { cellPaddingPx = 32, overflowLabelPx = 26 }: { cellPaddingPx?: number; overflowLabelPx?: number } = {},
): { labels: string[]; abbreviated: boolean } {
  const shown = states.slice(0, 3);
  const available =
    columnWidth - cellPaddingPx - (states.length > shown.length ? overflowLabelPx + GAP_PX : 0);

  const full = shown.map((s) => stateFullName(s));
  const needed =
    full.reduce((sum, label) => sum + chipWidth(label), 0) + GAP_PX * Math.max(0, full.length - 1);

  if (needed <= available) return { labels: full, abbreviated: false };
  return { labels: shown.map((s) => stateAbbreviation(s)), abbreviated: true };
}

/** Every US state plus DC, alphabetical, for pickers. */
export const US_STATE_NAMES: string[] = Object.values(STATE_ABBREV_TO_NAME).sort((a, b) =>
  a.localeCompare(b),
);
