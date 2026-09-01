// Hot-lead ("high value") evaluation. The conditions live in SystemConfig
// under `hot_lead_conditions` so admins can tune them from the dashboard;
// these defaults are the agreed starting definition:
//   500+ units, only good states, no affordable/Section 8 rental types,
//   residential rent debt, owner/operator.

export interface HotLeadConditions {
  minUnits: number;
  /** Every state on the lead must be classified "good". */
  requireAllGoodStates: boolean;
  /** Case-insensitive substrings; any match on a rental type disqualifies. */
  excludedRentalTypes: string[];
  /** Case-insensitive substrings; at least one debt type must match one. */
  requiredDebtKeywords: string[];
  /** Case-insensitive substrings; ownership must match one. */
  ownershipKeywords: string[];
}

export const DEFAULT_HOT_LEAD_CONDITIONS: HotLeadConditions = {
  minUnits: 500,
  requireAllGoodStates: true,
  excludedRentalTypes: ["affordable", "section 8", "section8"],
  requiredDebtKeywords: ["residential"],
  ownershipKeywords: ["own"],
};

export function parseHotLeadConditions(value: unknown): HotLeadConditions {
  if (!value || typeof value !== "object") return DEFAULT_HOT_LEAD_CONDITIONS;
  const v = value as Partial<HotLeadConditions>;
  return {
    minUnits: typeof v.minUnits === "number" ? v.minUnits : DEFAULT_HOT_LEAD_CONDITIONS.minUnits,
    requireAllGoodStates:
      typeof v.requireAllGoodStates === "boolean"
        ? v.requireAllGoodStates
        : DEFAULT_HOT_LEAD_CONDITIONS.requireAllGoodStates,
    excludedRentalTypes: Array.isArray(v.excludedRentalTypes)
      ? v.excludedRentalTypes.map(String)
      : DEFAULT_HOT_LEAD_CONDITIONS.excludedRentalTypes,
    requiredDebtKeywords: Array.isArray(v.requiredDebtKeywords)
      ? v.requiredDebtKeywords.map(String)
      : DEFAULT_HOT_LEAD_CONDITIONS.requiredDebtKeywords,
    ownershipKeywords: Array.isArray(v.ownershipKeywords)
      ? v.ownershipKeywords.map(String)
      : DEFAULT_HOT_LEAD_CONDITIONS.ownershipKeywords,
  };
}

export interface HotLeadInput {
  accountVolumeNum?: number | null;
  states?: string[] | null;
  rentalTypes?: string[] | null;
  debtTypes?: string[] | null;
  ownershipType?: string | null;
}

function containsAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => n && h.includes(n.toLowerCase()));
}

export function evaluateHotLead(
  input: HotLeadInput,
  conditions: HotLeadConditions,
  /** state name/abbrev (lowercased) -> "good" | "bad" */
  stateClassMap: Record<string, string>
): boolean {
  // Units
  if ((input.accountVolumeNum ?? 0) < conditions.minUnits) return false;

  // States: all present states must be good
  if (conditions.requireAllGoodStates) {
    const states = (input.states ?? []).filter(Boolean);
    if (states.length === 0) return false;
    const allGood = states.every(
      (s) => stateClassMap[s.trim().toLowerCase()] === "good"
    );
    if (!allGood) return false;
  }

  // Rental types: none may match the exclusions
  for (const rt of input.rentalTypes ?? []) {
    if (containsAny(rt, conditions.excludedRentalTypes)) return false;
  }

  // Debt types: at least one must match a required keyword
  if (conditions.requiredDebtKeywords.length > 0) {
    const debtTypes = (input.debtTypes ?? []).filter(Boolean);
    const hasMatch = debtTypes.some((d) =>
      containsAny(d, conditions.requiredDebtKeywords)
    );
    if (!hasMatch) return false;
  }

  // Ownership must match a keyword (e.g. "own" covers own / owner-operator / own and manage)
  if (conditions.ownershipKeywords.length > 0) {
    if (!containsAny(input.ownershipType ?? "", conditions.ownershipKeywords)) return false;
  }

  return true;
}
