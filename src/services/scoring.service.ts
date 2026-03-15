import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { logEvent } from "./activity-log.service";
import type { Lead } from "@prisma/client";

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
  return lead[field] ?? null;
}

function evaluateCondition(
  lead: Record<string, unknown>,
  condition: RuleCondition
): boolean {
  const value = getLeadFieldValue(lead, condition.field);
  const condValue = condition.value;

  switch (condition.operator) {
    case "equals":
      return String(value).toLowerCase() === String(condValue).toLowerCase();
    case "not_equals":
      return String(value).toLowerCase() !== String(condValue).toLowerCase();
    case "contains":
      return String(value ?? "")
        .toLowerCase()
        .includes(String(condValue).toLowerCase());
    case "in":
      if (Array.isArray(condValue)) {
        return condValue
          .map((v) => String(v).toLowerCase())
          .includes(String(value).toLowerCase());
      }
      return false;
    case "not_in":
      if (Array.isArray(condValue)) {
        return !condValue
          .map((v) => String(v).toLowerCase())
          .includes(String(value).toLowerCase());
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
}

function evaluateRule(
  lead: Record<string, unknown>,
  conditions: RuleCondition[]
): boolean {
  // All conditions must match (AND logic)
  return conditions.every((cond) => evaluateCondition(lead, cond));
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
  const [rules, tierRanges] = await Promise.all([
    prisma.scoringRule.findMany({
      where: { enabled: true },
      orderBy: { priority: "asc" },
    }),
    getTierRangesFromDB(),
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
    const conditions = rule.conditionsJson as unknown as RuleCondition[];
    const outcomes = rule.outcomesJson as unknown as RuleOutcome;

    if (evaluateRule(leadData, conditions)) {
      score += outcomes.scoreAdjustment;
      appliedRules.push({
        ruleName: rule.name,
        scoreAdjustment: outcomes.scoreAdjustment,
        reason: outcomes.reason,
        hardStop: outcomes.hardStop,
        action: outcomes.action,
      });
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
