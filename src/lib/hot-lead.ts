// High-value ("hot") lead rules. Fully admin-configurable: a list of
// field/operator/value conditions (all must match) evaluated against the
// lead's CRM fields and intake answers. Stored in SystemConfig under
// `hot_lead_conditions`; legacy fixed-shape configs are converted on read.

export type ConditionOp =
  | "gte"
  | "lte"
  | "equals"
  | "contains"
  | "not_contains"
  | "all_good_states";

export interface FieldCondition {
  field: string;
  op: ConditionOp;
  value?: string;
}

export interface HotLeadRules {
  conditions: FieldCondition[];
}

/** Field catalog for the admin rule builder. */
export const CONDITION_FIELDS: Array<{ key: string; label: string; kind: "number" | "array" | "string" | "states" }> = [
  { key: "units", label: "Total Units", kind: "number" },
  { key: "avgRent", label: "Avg Rent / Unit", kind: "number" },
  { key: "score", label: "Lead Score", kind: "number" },
  { key: "states", label: "States", kind: "states" },
  { key: "rentalTypes", label: "Rental Types", kind: "array" },
  { key: "propertyTypes", label: "Property Types", kind: "array" },
  { key: "debtTypes", label: "Debt Types", kind: "array" },
  { key: "listingSites", label: "Listing Sites", kind: "array" },
  { key: "pmSoftware", label: "PM Software", kind: "array" },
  { key: "ownership", label: "Ownership", kind: "string" },
  { key: "industry", label: "Industry", kind: "string" },
  { key: "businessType", label: "Business Type", kind: "string" },
  { key: "urgency", label: "Urgency", kind: "string" },
  { key: "qualityTier", label: "Quality Tier", kind: "string" },
  { key: "leadSource", label: "Lead Source", kind: "string" },
];

export const OPS_BY_KIND: Record<string, Array<{ op: ConditionOp; label: string }>> = {
  number: [
    { op: "gte", label: "is at least" },
    { op: "lte", label: "is at most" },
    { op: "equals", label: "equals" },
  ],
  array: [
    { op: "contains", label: "includes" },
    { op: "not_contains", label: "does not include" },
  ],
  string: [
    { op: "contains", label: "contains" },
    { op: "not_contains", label: "does not contain" },
    { op: "equals", label: "equals" },
  ],
  states: [
    { op: "all_good_states", label: "are all classified good" },
    { op: "contains", label: "include" },
    { op: "not_contains", label: "do not include" },
  ],
};

/** The agreed starting definition. */
export const DEFAULT_HOT_LEAD_RULES: HotLeadRules = {
  conditions: [
    { field: "units", op: "gte", value: "500" },
    { field: "states", op: "all_good_states" },
    { field: "rentalTypes", op: "not_contains", value: "affordable" },
    { field: "rentalTypes", op: "not_contains", value: "section 8" },
    { field: "debtTypes", op: "contains", value: "residential" },
    { field: "ownership", op: "contains", value: "own" },
  ],
};

/** Values pulled off the lead + intake form that conditions evaluate against. */
export interface HotLeadContext {
  units: number | null;
  avgRent: number | null;
  score: number | null;
  states: string[];
  rentalTypes: string[];
  propertyTypes: string[];
  debtTypes: string[];
  listingSites: string[];
  pmSoftware: string[];
  ownership: string;
  industry: string;
  businessType: string;
  urgency: string;
  qualityTier: string;
  leadSource: string;
}

export function parseHotLeadConditions(value: unknown): HotLeadRules {
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.conditions)) {
      const conditions = (v.conditions as Array<Record<string, unknown>>)
        .filter((c) => c && typeof c.field === "string" && typeof c.op === "string")
        .map((c) => ({ field: String(c.field), op: c.op as ConditionOp, value: c.value != null ? String(c.value) : undefined }));
      return { conditions };
    }
    // Legacy fixed shape → convert
    if ("minUnits" in v || "requireAllGoodStates" in v) {
      const conditions: FieldCondition[] = [];
      if (typeof v.minUnits === "number") conditions.push({ field: "units", op: "gte", value: String(v.minUnits) });
      if (v.requireAllGoodStates !== false) conditions.push({ field: "states", op: "all_good_states" });
      for (const t of (v.excludedRentalTypes as string[]) ?? []) conditions.push({ field: "rentalTypes", op: "not_contains", value: t });
      for (const k of (v.requiredDebtKeywords as string[]) ?? []) conditions.push({ field: "debtTypes", op: "contains", value: k });
      for (const k of (v.ownershipKeywords as string[]) ?? []) conditions.push({ field: "ownership", op: "contains", value: k });
      return { conditions };
    }
  }
  return DEFAULT_HOT_LEAD_RULES;
}

function ci(s: unknown): string {
  return String(s ?? "").toLowerCase();
}

function evalCondition(
  c: FieldCondition,
  ctx: HotLeadContext,
  stateClassMap: Record<string, string>
): boolean {
  const val = ci(c.value);

  if (c.field === "states") {
    if (c.op === "all_good_states") {
      if (ctx.states.length === 0) return false;
      return ctx.states.every((s) => stateClassMap[s.trim().toLowerCase()] === "good");
    }
    const match = ctx.states.some((s) => ci(s).includes(val));
    return c.op === "contains" ? match : !match;
  }

  const numeric: Record<string, number | null> = { units: ctx.units, avgRent: ctx.avgRent, score: ctx.score };
  if (c.field in numeric) {
    const n = numeric[c.field];
    const target = parseFloat(c.value ?? "");
    if (n == null || Number.isNaN(target)) return false;
    if (c.op === "gte") return n >= target;
    if (c.op === "lte") return n <= target;
    if (c.op === "equals") return n === target;
    return false;
  }

  const arrays: Record<string, string[]> = {
    rentalTypes: ctx.rentalTypes,
    propertyTypes: ctx.propertyTypes,
    debtTypes: ctx.debtTypes,
    listingSites: ctx.listingSites,
    pmSoftware: ctx.pmSoftware,
  };
  if (c.field in arrays) {
    const match = arrays[c.field].some((x) => ci(x).includes(val));
    return c.op === "contains" ? match : c.op === "not_contains" ? !match : false;
  }

  const strings: Record<string, string> = {
    ownership: ctx.ownership,
    industry: ctx.industry,
    businessType: ctx.businessType,
    urgency: ctx.urgency,
    qualityTier: ctx.qualityTier,
    leadSource: ctx.leadSource,
  };
  if (c.field in strings) {
    const s = ci(strings[c.field]);
    if (c.op === "contains") return s.includes(val);
    if (c.op === "not_contains") return !s.includes(val);
    if (c.op === "equals") return s === val;
  }

  return false;
}

/** All conditions must pass; an empty rule set never qualifies. */
export function evaluateHotLead(
  ctx: HotLeadContext,
  rules: HotLeadRules,
  stateClassMap: Record<string, string>
): boolean {
  if (rules.conditions.length === 0) return false;
  return rules.conditions.every((c) => evalCondition(c, ctx, stateClassMap));
}
