"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth, assertRole } from "@/lib/auth";
import {
  evaluateRulesForLead,
  getScoringContext,
  toScoringLeadData,
  type ScoreResult,
  type ScoringRuleLike,
} from "@/services/scoring.service";

/**
 * Read-only scoring simulation helpers for the admin rules page.
 * Nothing in this file writes to the database.
 */

const simRuleSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  priority: z.coerce.number().int().default(0),
  conditionsJson: z.array(
    z.object({
      field: z.string().min(1),
      operator: z.string().min(1),
      value: z.unknown(),
    })
  ),
  outcomesJson: z.object({
    scoreAdjustment: z.coerce.number(),
    reason: z.string().default(""),
    hardStop: z.boolean().optional(),
    action: z.string().optional(),
  }),
});

const simRulesSchema = z.array(simRuleSchema);

const manualLeadSchema = z.object({
  units: z.number().nullable().optional(),
  avgRent: z.number().nullable().optional(),
  states: z.array(z.string()).default([]),
  debtTypes: z.array(z.string()).default([]),
  rentalTypes: z.array(z.string()).default([]),
  ownership: z.string().optional(),
  hasCompany: z.boolean().default(false),
  hasEmail: z.boolean().default(false),
  hasPhone: z.boolean().default(false),
});

export type ManualLeadInput = z.input<typeof manualLeadSchema>;
export type SimRuleInput = z.input<typeof simRuleSchema>;

export interface LeadSearchHit {
  id: string;
  fullName: string | null;
  companyName: string | null;
  email: string | null;
  score: number | null;
  qualityTier: string | null;
}

export interface SimulationResult extends ScoreResult {
  leadLabel: string;
  currentScore: number | null;
  currentTier: string | null;
}

export interface ImpactPreview {
  total: number;
  tiers: string[];
  before: Record<string, number>;
  after: Record<string, number>;
  changed: number;
  changes: Array<{ id: string; label: string; beforeTier: string | null; afterTier: string | null; beforeScore: number | null; afterScore: number }>;
}

const NO_TIER = "No tier";

function leadLabel(lead: { fullName: string | null; companyName: string | null; email: string | null }): string {
  return lead.companyName || lead.fullName || lead.email || "Unnamed lead";
}

function parseRules(rules: unknown): ScoringRuleLike[] {
  return simRulesSchema.parse(rules);
}

/** Builds a lead-like object from a handful of manual inputs. */
function buildManualLead(input: ManualLeadInput): Record<string, unknown> {
  const m = manualLeadSchema.parse(input);
  const states = m.states.map((s) => s.trim().toUpperCase()).filter(Boolean);
  const debtTypes = m.debtTypes.map((s) => s.trim()).filter(Boolean);
  const rentalTypes = m.rentalTypes.map((s) => s.trim()).filter(Boolean);
  const units = m.units ?? null;
  const avgRent = m.avgRent ?? null;

  return {
    id: "simulated",
    fullName: "Sample Lead",
    companyName: m.hasCompany ? "Sample Company" : null,
    email: m.hasEmail ? "sample@example.com" : null,
    phone: m.hasPhone ? "5555550100" : null,
    state: states.length ? states.join(",") : null,
    states: states.length ? states : null,
    debtType: debtTypes.length ? debtTypes.join(", ") : null,
    accountVolume: units !== null ? String(units) : null,
    accountVolumeNum: units,
    avgRentNum: avgRent,
    rawPayloadJson: {
      _rawIntakeForm: {
        totalUnits: units !== null ? String(units) : undefined,
        units,
        avgRent,
        rentalTypes: rentalTypes.length ? rentalTypes : undefined,
        debtTypes: debtTypes.length ? debtTypes : undefined,
        ownershipType: m.ownership?.trim() || undefined,
      },
    },
  };
}

export async function searchLeadsForSimulation(query: string): Promise<LeadSearchHit[]> {
  const session = await auth();
  assertRole(session, "ADMIN");

  const q = query.trim();
  if (q.length < 2) return [];

  return prisma.lead.findMany({
    where: {
      status: { not: "ARCHIVED" },
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, fullName: true, companyName: true, email: true, score: true, qualityTier: true },
  });
}

/**
 * Scores one lead (existing by id, or built from manual fields) against the
 * supplied rules. Nothing is persisted.
 */
export async function simulateScoring(
  target: { leadId?: string; manual?: ManualLeadInput },
  rules: SimRuleInput[]
): Promise<SimulationResult> {
  const session = await auth();
  assertRole(session, "ADMIN");

  const parsedRules = parseRules(rules);
  const ctx = await getScoringContext();

  if (target.leadId) {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: target.leadId } });
    const result = evaluateRulesForLead(toScoringLeadData(lead), parsedRules, ctx);
    return { ...result, leadLabel: leadLabel(lead), currentScore: lead.score, currentTier: lead.qualityTier };
  }

  const leadData = buildManualLead(target.manual ?? {});
  const result = evaluateRulesForLead(leadData, parsedRules, ctx);
  return { ...result, leadLabel: "Manual lead", currentScore: null, currentTier: null };
}

/**
 * Re-scores the 100 most recent non-archived leads with the supplied rules and
 * compares the resulting tiers against what is stored. Nothing is persisted.
 */
export async function previewRuleImpact(rules: SimRuleInput[]): Promise<ImpactPreview> {
  const session = await auth();
  assertRole(session, "ADMIN");

  const parsedRules = parseRules(rules);
  const [ctx, leads] = await Promise.all([
    getScoringContext(),
    prisma.lead.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const tierOrder = ctx.tierRanges.map((r) => r.tier);
  const before: Record<string, number> = {};
  const after: Record<string, number> = {};
  const changes: ImpactPreview["changes"] = [];

  for (const lead of leads) {
    const beforeTier = lead.qualityTier ?? NO_TIER;
    const result = evaluateRulesForLead(toScoringLeadData(lead), parsedRules, ctx);
    const afterTier = result.qualityTier ?? NO_TIER;

    before[beforeTier] = (before[beforeTier] ?? 0) + 1;
    after[afterTier] = (after[afterTier] ?? 0) + 1;

    if (beforeTier !== afterTier) {
      changes.push({
        id: lead.id,
        label: leadLabel(lead),
        beforeTier: lead.qualityTier,
        afterTier: result.qualityTier,
        beforeScore: lead.score,
        afterScore: result.score,
      });
    }
  }

  const extraTiers = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter(
    (t) => !tierOrder.includes(t)
  );
  const tiers = [...tierOrder, ...extraTiers.filter((t) => t !== NO_TIER), ...(extraTiers.includes(NO_TIER) ? [NO_TIER] : [])];

  return {
    total: leads.length,
    tiers,
    before,
    after,
    changed: changes.length,
    changes: changes.slice(0, 15),
  };
}
