import { prisma } from "@/lib/db";
import { logEvent } from "./activity-log.service";
import type { Lead, QualityTier } from "@prisma/client";

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

function mapScoreToTier(score: number): QualityTier {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "POOR";
}

function determineAction(
  score: number,
  tier: QualityTier,
  appliedRules: AppliedRule[]
): string {
  const hardStop = appliedRules.find((r) => r.hardStop);
  if (hardStop) return hardStop.action ?? "disqualify";

  if (tier === "A" || tier === "B") return "contact";
  if (tier === "C") return "review_manually";
  return "refer_or_disqualify";
}

export async function scoreLead(lead: Lead): Promise<{
  score: number;
  qualityTier: QualityTier;
  recommendedAction: string;
  appliedRules: AppliedRule[];
}> {
  const rules = await prisma.scoringRule.findMany({
    where: { enabled: true },
    orderBy: { priority: "asc" },
  });

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
    const conditions = rule.conditionsJson as RuleCondition[];
    const outcomes = rule.outcomesJson as RuleOutcome;

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

  const qualityTier = mapScoreToTier(score);
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
      scoreReasons: result.appliedRules as unknown as Record<string, unknown>[],
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
