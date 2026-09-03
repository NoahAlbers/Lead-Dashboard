// What a visitor has typed into the intake form so far.
//
// The form sends a snapshot of its own state with every batch, so the live
// monitor can show a form in progress. Keys are the form's field names; this
// module is the single place they get human labels and display order, and the
// single place a raw snapshot is cleaned before it is stored or shown.

/** Field order and labels, matching the order the form asks them in. */
const FIELD_LABELS: Array<[string, string]> = [
  ["fullName", "Name"],
  ["companyName", "Company"],
  ["noCompany", "Independent owner"],
  ["companyWebsite", "Website"],
  ["noWebsite", "No website"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["priorAgency", "Worked with an agency before"],
  ["debtTypes", "Debt types"],
  ["customDebtType", "Other debt type"],
  ["debtsNow", "Debts ready now"],
  ["states", "States"],
  ["ownershipType", "Ownership"],
  ["ownPercent", "Percent owned"],
  ["totalUnits", "Total units"],
  ["rentalTypes", "Rental types"],
  ["propertyTypes", "Property types"],
  ["avgRent", "Average rent"],
  ["listingSites", "Listing sites"],
  ["customListing", "Other listing site"],
  ["pmSoftware", "PM software"],
  ["customPM", "Other software"],
  ["comments", "Comments"],
  ["noQuestions", "No questions"],
];

const LABEL_BY_KEY = new Map(FIELD_LABELS);
const ORDER_BY_KEY = new Map(FIELD_LABELS.map(([k], i) => [k, i]));

/** Fields that are the visitor's own contact details, highlighted in the UI. */
export const CONTACT_KEYS = new Set(["fullName", "email", "phone", "companyName"]);

/** Internal bookkeeping the form keeps in the same state object. Never shown. */
const IGNORED_KEYS = new Set(["rentSliderPos", "certifyNoDebt", "certifyOwesDebt"]);

const MAX_FIELDS = 40;
const MAX_VALUE_CHARS = 400;
const MAX_LIST_ITEMS = 25;

export interface AnswerEntry {
  key: string;
  label: string;
  value: string;
  isContact: boolean;
}

function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Turn one raw value into a display string, or null when there is nothing
 * worth showing (blank, empty list, or an unchecked box).
 */
function displayValue(key: string, raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean") return raw ? "Yes" : null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    if (key === "avgRent") return `$${Math.round(raw).toLocaleString()}/mo`;
    if (key === "ownPercent") return `${Math.round(raw)}%`;
    return raw.toLocaleString();
  }
  if (typeof raw === "string") {
    const v = raw.trim();
    return v === "" ? null : v.slice(0, MAX_VALUE_CHARS);
  }
  if (Array.isArray(raw)) {
    const items = raw
      .filter((x): x is string | number => typeof x === "string" || typeof x === "number")
      .map((x) => String(x).trim())
      .filter((x) => x !== "");
    if (items.length === 0) return null;
    const shown = items.slice(0, MAX_LIST_ITEMS).join(", ");
    return items.length > MAX_LIST_ITEMS
      ? `${shown} and ${items.length - MAX_LIST_ITEMS} more`.slice(0, MAX_VALUE_CHARS)
      : shown.slice(0, MAX_VALUE_CHARS);
  }
  return null;
}

/**
 * Clean an incoming snapshot down to what is worth storing: known-shape values
 * only, blanks dropped, sizes capped. Returns null when nothing is left, so a
 * visitor who has typed nothing does not overwrite an earlier snapshot.
 */
export function sanitizeAnswers(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= MAX_FIELDS) break;
    if (IGNORED_KEYS.has(key) || key.length > 60) continue;
    if (displayValue(key, value) === null) continue;
    if (typeof value === "string") out[key] = value.trim().slice(0, MAX_VALUE_CHARS);
    else if (typeof value === "number" || typeof value === "boolean") out[key] = value;
    else if (Array.isArray(value)) {
      out[key] = value
        .filter((x): x is string | number => typeof x === "string" || typeof x === "number")
        .slice(0, MAX_LIST_ITEMS)
        .map((x) => String(x).slice(0, 120));
    } else continue;
    count++;
  }
  return count > 0 ? out : null;
}

/** A stored snapshot as ordered, labelled rows ready to render. */
export function answerEntries(raw: unknown): AnswerEntry[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const entries: AnswerEntry[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (IGNORED_KEYS.has(key)) continue;
    const display = displayValue(key, value);
    if (display === null) continue;
    entries.push({
      key,
      label: LABEL_BY_KEY.get(key) ?? humanizeKey(key),
      value: display,
      isContact: CONTACT_KEYS.has(key),
    });
  }
  const rank = (k: string) => ORDER_BY_KEY.get(k) ?? 999;
  return entries.sort((a, b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label));
}
