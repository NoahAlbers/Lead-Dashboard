import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { logEvent } from "./activity-log.service";
import type { Lead } from "@prisma/client";
import { getStateClassificationMap } from "@/actions/state-classification.actions";

interface RuleCondition {
  field: string;
  operator: string;
  value: unknown;
}

interface RuleOutcome {
  scoreAdjustment: number;
  reason: string;
  hardStop?: boolean;
  action?: string;
}

interface AppliedRule {
  ruleName: string;
  scoreAdjustment: number;
  reason: string;
  hardStop?: boolean;
  action?: string;
}

interface TierRange {
  tier: string;
  min: number;
  max: number;
}

function getLeadFieldValue(lead: Record<string, unknown>, field: string): unknown {
  let raw = lead[field] ?? null;

  // If field is "state" and lead.states exists as an array, return it
  if (field === "state" && Array.isArray(lead["states"]) && (lead["states"] as unknown[]).length > 0) {
    return lead["states"];
  }

  // Check rawPayloadJson._rawIntakeForm for residential/intake fields
  if (raw === null || raw === undefined) {
    const rawPayload = lead.rawPayloadJson as Record<string, unknown> | null;
    if (rawPayload?._rawIntakeForm) {
      const intakeForm = rawPayload._rawIntakeForm as Record<string, unknown>;
      raw = intakeForm[field] ?? null;
    }
  }

  // If the return value is a JSON string that looks like an array, try to parse it
  if (typeof raw === "string" && raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not valid JSON, return as-is
    }
  }

  return raw;
}

function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && !Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}

function evaluateCondition(
  lead: Record<string, unknown>,
  condition: RuleCondition,
  stateClassMap?: Record<string, string>
): boolean {
  try {
    // Handle state_classification virtual field
    if (condition.field === "state_classification" && stateClassMap) {
      const statesArr = lead["states"];
      const singleState = lead["state"];
      const allStates: string[] = [];

      if (Array.isArray(statesArr) && statesArr.length > 0) {
        allStates.push(...statesArr.map((s: unknown) => String(s).toUpperCase()));
      } else if (singleState) {
        allStates.push(...String(singleState).split(",").map((s) => s.trim().toUpperCase()).filter(Boolean));
      }

      if (allStates.length === 0) return false;

      const condVal = String(condition.value).toLowerCase();
      switch (condition.operator) {
        case "equals":
          return allStates.some((s) => (stateClassMap[s] ?? "unknown") === condVal);
        case "not_equals":
          return !allStates.some((s) => (stateClassMap[s] ?? "unknown") === condVal);
        default:
          return false;
      }
    }

    let value = getLeadFieldValue(lead, condition.field);

    // For the "state" field, also check the "states" array so rules can match any selected state
    if (condition.field === "state") {
      const statesArr = lead["states"];
      if (Array.isArray(statesArr) && statesArr.length > 0) {
        value = statesArr;
      }
    }

    const condValue = condition.value;

    // Null/undefined guard: if value is null/undefined and operator is not is_empty/is_not_empty, return false
    if ((value === null || value === undefined) && condition.operator !== "is_empty" && condition.operator !== "is_not_empty") {
      return false;
    }

    // Treat empty/whitespace-only strings as null for all operators except is_empty/is_not_empty
    if (typeof value === "string" && value.trim() === "" && condition.operator !== "is_empty" && condition.operator !== "is_not_empty") {
      return false;
    }

    // If the lead value is an array, check if ANY element satisfies the condition
    if (Array.isArray(value)) {
      const items = value.map((v) => safeStringify(v).toLowerCase());
      switch (condition.operator) {
        case "equals":
          return items.includes(safeStringify(condValue).toLowerCase());
        case "not_equals":
          return !items.includes(safeStringify(condValue).toLowerCase());
        case "contains":
          return items.some((item) => item.includes(safeStringify(condValue).toLowerCase()));
        case "in":
          if (Array.isArray(condValue)) {
            const targets = condValue.map((v) => safeStringify(v).toLowerCase());
            return items.some((item) => targets.includes(item));
          }
          return false;
        case "not_in":
          if (Array.isArray(condValue)) {
            const targets = condValue.map((v) => safeStringify(v).toLowerCase());
            return !items.some((item) => targets.includes(item));
          }
          return true;
        case "is_empty":
          return value.length === 0;
        case "is_not_empty":
          return value.length > 0;
        default:
          return false;
      }
    }

    const safeValue = safeStringify(value).toLowerCase();
    const safeCondValue = safeStringify(condValue).toLowerCase();

    switch (condition.operator) {
      case "equals":
        return safeValue === safeCondValue;
      case "not_equals":
        return safeValue !== safeCondValue;
      case "contains":
        return safeValue.includes(safeCondValue);
      case "in":
        if (Array.isArray(condValue)) {
          return condValue.map((v) => safeStringify(v).toLowerCase()).includes(safeValue);
        }
        return false;
      case "not_in":
        if (Array.isArray(condValue)) {
          return !condValue.map((v) => safeStringify(v).toLowerCase()).includes(safeValue);
        }
        return true;
      case "greater_than": {
        const numVal = Number(value);
        return !isNaN(numVal) && numVal > Number(condValue);
      }
      case "less_than": {
        const numVal = Number(value);
        return !isNaN(numVal) && numVal < Number(condValue);
      }
      case "is_empty":
        return value === null || value === undefined || String(value).trim() === "";
      case "is_not_empty":
        return value !== null && value !== undefined && String(value).trim() !== "";
      default:
        return false;
    }
  } catch (err) {
    console.error(`[Scoring] evaluateCondition failed for field "${condition.field}" (operator: ${condition.operator}):`, err);
    return false;
  }
}

function evaluateRule(
  lead: Record<string, unknown>,
  conditions: RuleCondition[],
  stateClassMap?: Record<string, string>
): boolean {
  // All conditions must match (AND logic)
  return conditions.every((cond) => evaluateCondition(lead, cond, stateClassMap));
}

const DEFAULT_TIER_RANGES: TierRange[] = [
  { tier: "A Lead", min: 80, max: 100 },
  { tier: "B Lead", min: 60, max: 79 },
  { tier: "C Lead", min: 40, max: 59 },
  { tier: "Poor Fit", min: 0, max: 39 },
];

async function getTierRangesFromDB(): Promise<TierRange[]> {
  try {
    const record = await prisma.customStatus.findUnique({
      where: { id: "system-tier-ranges" },
    });
    if (!record) return DEFAULT_TIER_RANGES;
    const parsed = JSON.parse(record.color);
    // New format has {id, name, color, min, max}; old format has {tier, min, max}
    return parsed.map((r: { id?: string; name?: string; tier?: string; label?: string; min: number; max: number }) => ({
      tier: r.name ?? r.label ?? r.tier ?? "Unknown",
      min: r.min,
      max: r.max,
    }));
  } catch {
    return DEFAULT_TIER_RANGES;
  }
}

function mapScoreToTierWithRanges(score: number, ranges: TierRange[]): string | null {
  for (const range of ranges) {
    if (score >= range.min && score <= range.max) {
      return range.tier;
    }
  }
  return null; // No matching tier (gap in ranges)
}

function determineAction(
  score: number,
  tier: string | null,
  appliedRules: AppliedRule[]
): string {
  const hardStop = appliedRules.find((r) => r.hardStop);
  if (hardStop) return hardStop.action ?? "disqualify";

  // Use score-based heuristic since tier names are now user-defined
  if (score >= 60) return "contact";
  if (score >= 40) return "review_manually";
  return "refer_or_disqualify";
}

export async function scoreLead(lead: Lead): Promise<{
  score: number;
  qualityTier: string | null;
  recommendedAction: string;
  appliedRules: AppliedRule[];
}> {
  const [rules, tierRanges, stateClassMap] = await Promise.all([
    prisma.scoringRule.findMany({
      where: { enabled: true },
      orderBy: { priority: "asc" },
    }),
    getTierRangesFromDB(),
    getStateClassificationMap(),
  ]);

  const leadData = lead as unknown as Record<string, unknown>;
  // Convert Decimal fields to numbers for comparison
  if (lead.balanceAmount) {
    leadData.balanceAmount = Number(lead.balanceAmount);
  }
  if (lead.estimatedClaimValue) {
    leadData.estimatedClaimValue = Number(lead.estimatedClaimValue);
  }

  let score = 50; // Base score
  const appliedRules: AppliedRule[] = [];

  for (const rule of rules) {
    try {
      const conditions = rule.conditionsJson as unknown as RuleCondition[];
      const outcomes = rule.outcomesJson as unknown as RuleOutcome;

      if (evaluateRule(leadData, conditions, stateClassMap)) {
        score += outcomes.scoreAdjustment;
        appliedRules.push({
          ruleName: rule.name,
          scoreAdjustment: outcomes.scoreAdjustment,
          reason: outcomes.reason,
          hardStop: outcomes.hardStop,
          action: outcomes.action,
        });
      }
    } catch (err) {
      console.error(`[Scoring] Rule "${rule.name}" failed for lead ${lead.id}:`, err);
      // Skip this rule, continue scoring with remaining rules
      continue;
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  const qualityTier = mapScoreToTierWithRanges(score, tierRanges);
  const recommendedAction = determineAction(score, qualityTier, appliedRules);

  return { score, qualityTier, recommendedAction, appliedRules };
}

export async function scoreAndUpdateLead(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const result = await scoreLead(lead);

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      score: result.score,
      qualityTier: result.qualityTier,
      recommendedAction: result.recommendedAction,
      scoreReasons: result.appliedRules as unknown as Prisma.InputJsonValue,
    },
  });

  await logEvent(leadId, "score_calculated", {
    score: result.score,
    qualityTier: result.qualityTier,
    recommendedAction: result.recommendedAction,
    appliedRules: result.appliedRules,
  });

  return result;
}
