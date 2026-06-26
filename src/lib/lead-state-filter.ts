import type { Prisma } from "@prisma/client";
import { normalizeState, STATE_ABBREV_TO_NAME } from "@/lib/us-states";

/**
 * Pure helpers for building Prisma `where` clauses for the Lead Inbox advanced
 * filters. No "use server" — importable from server actions and (where useful)
 * shared logic. See the plan in /root/.claude/plans for the design rationale.
 *
 * Data reality:
 *  - `lead.states` is a JSON array of canonical title-case full names
 *    (e.g. ["Florida","California"]). `array_contains` on a Postgres JSON column
 *    is CASE-SENSITIVE exact element match, so it must be fed canonical names.
 *  - `lead.state` is a single string (usually a full name, but legacy rows may
 *    hold an abbreviation or odd casing), so it is matched with insensitive
 *    `equals` on both the full name and the abbreviation.
 */

// Reverse lookup: lowercase full name -> abbreviation.
const NAME_TO_ABBREV: Record<string, string> = {};
for (const [abbrev, name] of Object.entries(STATE_ABBREV_TO_NAME)) {
  NAME_TO_ABBREV[name.toLowerCase()] = abbrev;
}

/** A Prisma predicate that matches no rows (used when a filter can't match). */
const MATCH_NONE: Prisma.LeadWhereInput = { id: { in: [] } };

function expand(value: string): { fullName: string; abbrev: string | null } | null {
  const fullName = normalizeState(value);
  if (!fullName) return null;
  const abbrev = NAME_TO_ABBREV[fullName.toLowerCase()] ?? null;
  return { fullName, abbrev };
}

/**
 * Match leads whose combined state set (the `states` JSON array UNION the single
 * `state` string) contains ANY of `values`. Inputs may be abbreviations or full
 * names in any casing; each is normalized to its canonical title-case full name.
 * Returns `{}` (a no-op) when there is nothing to match.
 */
export function hasAnyStates(values: string[]): Prisma.LeadWhereInput {
  const seen = new Set<string>();
  const or: Prisma.LeadWhereInput[] = [];
  for (const v of values) {
    const e = expand(v);
    if (!e || seen.has(e.fullName)) continue;
    seen.add(e.fullName);
    // JSON array — exact canonical full name
    or.push({ states: { array_contains: [e.fullName] } });
    // single field — insensitive equals on full name…
    or.push({ state: { equals: e.fullName, mode: "insensitive" } });
    // …and on abbreviation, to catch legacy rows that stored e.g. "FL"
    if (e.abbrev) or.push({ state: { equals: e.abbrev, mode: "insensitive" } });
  }
  if (or.length === 0) return {};
  return { OR: or };
}

export type StateClassRecord = {
  stateName: string;
  stateAbbrev: string;
  classification: string;
};

/**
 * Build a `where` for a classification mode over a lead's combined state set.
 * A lead with one good + one banned state matches `any_good`, `any_bad`, and
 * `mixed`, but is excluded from `only_good` / `only_bad`.
 *
 * Returns `null` for an unrecognized mode (caller should ignore it).
 */
export function buildStateClassWhere(
  mode: string,
  classifications: StateClassRecord[]
): Prisma.LeadWhereInput | null {
  const good: string[] = [];
  const banned: string[] = [];
  const unknown: string[] = [];
  for (const s of classifications) {
    const list =
      s.classification === "good" ? good : s.classification === "banned" ? banned : unknown;
    // Use the abbreviation: normalizeState() (which ingestion also uses) maps it
    // to the exact canonical name stored on leads, so this stays consistent even
    // where the classification table's full name differs (e.g. DC).
    list.push(s.stateAbbrev);
  }

  const anyGood = hasAnyStates(good);
  const anyBanned = hasAnyStates(banned);
  const anyUnknown = hasAnyStates(unknown);

  switch (mode) {
    case "any_good":
      return good.length ? anyGood : MATCH_NONE;
    case "any_bad":
      return banned.length ? anyBanned : MATCH_NONE;
    case "only_good":
      if (!good.length) return MATCH_NONE;
      return banned.length ? { AND: [anyGood, { NOT: anyBanned }] } : anyGood;
    case "only_bad":
      if (!banned.length) return MATCH_NONE;
      return good.length ? { AND: [anyBanned, { NOT: anyGood }] } : anyBanned;
    case "mixed":
      return good.length && banned.length ? { AND: [anyGood, anyBanned] } : MATCH_NONE;
    case "unknown":
      return unknown.length ? anyUnknown : MATCH_NONE;
    default:
      return null;
  }
}

/**
 * Build a numeric range filter from an optional min/max pair.
 *  - min only  -> { gte }   ("greater than or equal")
 *  - max only  -> { lte }   ("less than or equal")
 *  - both      -> range (equal-to is encoded as min === max)
 * Returns undefined when neither bound is a usable number.
 * Works for Int and Decimal columns (Prisma accepts numbers for both).
 */
export function numericRange(
  min?: number,
  max?: number
): { gte?: number; lte?: number } | undefined {
  const f: { gte?: number; lte?: number } = {};
  if (typeof min === "number" && !Number.isNaN(min)) f.gte = min;
  if (typeof max === "number" && !Number.isNaN(max)) f.lte = max;
  return Object.keys(f).length ? f : undefined;
}
