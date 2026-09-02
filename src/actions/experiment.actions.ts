"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

export interface VariantDef {
  key: string;
  weight: number;
  description?: string;
  flags?: Record<string, boolean | string | number>;
}

export interface ExperimentInput {
  key: string;
  name: string;
  hypothesis?: string;
  primaryGoal: "completed" | "contact_reached" | "hot_lead";
  variants: VariantDef[];
}

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");
  return session;
}

export async function listExperiments() {
  await requireAdmin();
  return prisma.experiment.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
}

export async function saveExperiment(id: string | null, input: ExperimentInput) {
  await requireAdmin();
  const key = input.key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  if (!key) throw new Error("Give the experiment a key");
  const variants = input.variants
    .map((v) => ({ key: v.key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-"), weight: Math.max(0, Number(v.weight) || 0), description: v.description?.trim() || undefined, flags: v.flags ?? {} }))
    .filter((v) => v.key);
  if (variants.length < 2) throw new Error("An experiment needs at least two variants");
  const data = {
    key,
    name: input.name.trim() || key,
    hypothesis: input.hypothesis?.trim() || null,
    primaryGoal: input.primaryGoal,
    variantsJson: variants as unknown as Prisma.InputJsonValue,
  };
  const row = id
    ? await prisma.experiment.update({ where: { id }, data })
    : await prisma.experiment.create({ data: { ...data, status: "draft" } });
  revalidatePath("/admin/experiments");
  return row;
}

/** The form's built-in 8-way layout test: pitches x speed x grouping, with today's form as the control. */
const FORM_LAYOUT_PRESET: VariantDef[] = [
  { key: "classic", weight: 50, description: "The form as it is today", flags: {} },
  { key: "no_pitch", weight: 7.142857, description: "No selling-point screens", flags: { skipPitchScreens: true } },
  { key: "fast", weight: 7.142857, description: "Faster transitions", flags: { fastTransitions: true } },
  { key: "no_pitch_fast", weight: 7.142857, description: "No selling points, faster transitions", flags: { skipPitchScreens: true, fastTransitions: true } },
  { key: "grouped", weight: 7.142857, description: "2-4 questions per card", flags: { groupedQuestions: true } },
  { key: "fast_grouped", weight: 7.142857, description: "Faster transitions, 2-4 questions per card", flags: { fastTransitions: true, groupedQuestions: true } },
  { key: "no_pitch_grouped", weight: 7.142857, description: "No selling points, 2-4 questions per card", flags: { skipPitchScreens: true, groupedQuestions: true } },
  { key: "no_pitch_fast_grouped", weight: 7.142857, description: "No selling points, faster transitions, 2-4 questions per card", flags: { skipPitchScreens: true, fastTransitions: true, groupedQuestions: true } },
];

export async function createFormLayoutPreset() {
  await requireAdmin();
  const existing = await prisma.experiment.findUnique({ where: { key: "form_layout" } });
  if (existing) throw new Error("The form layout test already exists; edit it below instead");
  const row = await prisma.experiment.create({
    data: {
      key: "form_layout",
      name: "Form layout: pitches × speed × grouping",
      hypothesis: "Fewer pitch screens, faster transitions, and grouped questions each change completion; the full factorial shows which combination wins.",
      primaryGoal: "completed",
      status: "draft",
      variantsJson: FORM_LAYOUT_PRESET as unknown as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/admin/experiments");
  return row;
}

export async function setExperimentStatus(id: string, status: "draft" | "running" | "paused" | "ended") {
  await requireAdmin();
  const current = await prisma.experiment.findUniqueOrThrow({ where: { id } });
  await prisma.experiment.update({
    where: { id },
    data: {
      status,
      startedAt: status === "running" && !current.startedAt ? new Date() : current.startedAt,
      endedAt: status === "ended" ? new Date() : null,
    },
  });
  revalidatePath("/admin/experiments");
}

export async function deleteExperiment(id: string) {
  await requireAdmin();
  await prisma.experiment.delete({ where: { id } });
  revalidatePath("/admin/experiments");
}

export interface VariantResult {
  key: string;
  sessions: number;
  reachedContact: number;
  completed: number;
  leads: number;
  hotLeads: number;
  contacted: number;
  won: number;
  goalRate: number; // primary goal conversions / sessions
  upliftPct: number | null; // vs control (first variant)
  confidence: number | null; // 0-100, two-proportion z-test vs control
}

/** One layout flag measured across every variant that has it on versus every variant that has it off. */
export interface FactorResult {
  flag: string;
  label: string;
  on: { sessions: number; goal: number };
  off: { sessions: number; goal: number };
  onRate: number;
  offRate: number;
  upliftPct: number | null; // on vs off, null if the off rate is 0
  confidence: number | null; // 0-100, two-proportion z-test on vs off
}

const FACTOR_LABELS: Record<string, string> = {
  skipPitchScreens: "Selling points removed",
  fastTransitions: "Faster transitions",
  groupedQuestions: "Questions grouped",
};

/** Two-proportion z-test confidence (0-100) that two groups differ; null when it cannot be computed. */
function proportionConfidence(goal1: number, n1: number, goal2: number, n2: number): number | null {
  if (n1 === 0 || n2 === 0) return null;
  const pooled = (goal1 + goal2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  return se > 0 ? zToConfidence((goal2 / n2 - goal1 / n1) / se) : null;
}

function zToConfidence(z: number): number {
  // Two-sided normal CDF approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  const twoSided = 2 * p;
  return Math.round((1 - twoSided) * 100);
}

/** Per-variant funnel and downstream lead outcomes for one experiment. */
export async function getExperimentResults(experimentId: string): Promise<{ variants: VariantResult[]; factors: FactorResult[]; since: string | null }> {
  await requireAdmin();
  const exp = await prisma.experiment.findUniqueOrThrow({ where: { id: experimentId } });
  const defs = (exp.variantsJson as unknown as VariantDef[]) ?? [];
  const since = exp.startedAt ?? exp.createdAt;

  const sessions = await prisma.formSession.findMany({
    where: { startedAt: { gte: since }, variantsJson: { path: [exp.key], not: Prisma.DbNull } },
    select: { variantsJson: true, outcome: true, reachedContact: true, leadId: true },
  });
  const leadIds = sessions.map((s) => s.leadId).filter((x): x is string => !!x);
  const leads = leadIds.length
    ? await prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, qualityTier: true, firstContactAt: true, status: true } })
    : [];
  const leadById = new Map(leads.map((l) => [l.id, l]));
  // An archived lead is out of every number until it is unarchived.
  const archived = new Set(leads.filter((l) => l.status === "ARCHIVED").map((l) => l.id));
  const { getTierRanges } = await import("@/actions/status.actions");
  const tiers = await getTierRanges();
  const hot = new Set(tiers.slice(0, 2).map((t) => t.name));

  const results: VariantResult[] = defs.map((v) => ({
    key: v.key, sessions: 0, reachedContact: 0, completed: 0, leads: 0, hotLeads: 0, contacted: 0, won: 0, goalRate: 0, upliftPct: null, confidence: null,
  }));
  const byKey = new Map(results.map((r) => [r.key, r]));
  const flagsByKey = new Map(defs.map((v) => [v.key, v.flags ?? {}]));

  // Every flag any variant mentions becomes a factor, measured on vs off across all sessions.
  const factorKeys = Array.from(new Set(defs.flatMap((v) => Object.keys(v.flags ?? {}))));
  const factors: FactorResult[] = factorKeys.map((flag) => ({
    flag, label: FACTOR_LABELS[flag] ?? flag, on: { sessions: 0, goal: 0 }, off: { sessions: 0, goal: 0 }, onRate: 0, offRate: 0, upliftPct: null, confidence: null,
  }));

  for (const s of sessions) {
    if (s.leadId && archived.has(s.leadId)) continue;
    const vk = (s.variantsJson as Record<string, string> | null)?.[exp.key];
    const r = vk ? byKey.get(vk) : undefined;
    if (!r) continue;
    r.sessions++;
    if (s.reachedContact) r.reachedContact++;
    if (s.outcome === "completed") r.completed++;
    const lead = s.leadId ? leadById.get(s.leadId) : undefined;
    let isHot = false;
    if (lead) {
      r.leads++;
      if (lead.qualityTier && hot.has(lead.qualityTier)) { r.hotLeads++; isHot = true; }
      if (lead.firstContactAt) r.contacted++;
      if (lead.status === "WON") r.won++;
    }
    const hitGoal = exp.primaryGoal === "contact_reached" ? !!s.reachedContact : exp.primaryGoal === "hot_lead" ? isHot : s.outcome === "completed";
    const sessionFlags = flagsByKey.get(r.key) ?? {};
    for (const f of factors) {
      const side = sessionFlags[f.flag] ? f.on : f.off;
      side.sessions++;
      if (hitGoal) side.goal++;
    }
  }

  const goalOf = (r: VariantResult) => exp.primaryGoal === "contact_reached" ? r.reachedContact : exp.primaryGoal === "hot_lead" ? r.hotLeads : r.completed;
  for (const r of results) r.goalRate = r.sessions ? goalOf(r) / r.sessions : 0;
  const control = results[0];
  for (const r of results.slice(1)) {
    if (!control || control.sessions === 0 || r.sessions === 0) continue;
    r.upliftPct = control.goalRate > 0 ? Math.round(((r.goalRate - control.goalRate) / control.goalRate) * 100) : null;
    r.confidence = proportionConfidence(goalOf(control), control.sessions, goalOf(r), r.sessions);
  }

  for (const f of factors) {
    f.onRate = f.on.sessions ? f.on.goal / f.on.sessions : 0;
    f.offRate = f.off.sessions ? f.off.goal / f.off.sessions : 0;
    if (f.on.sessions === 0 || f.off.sessions === 0) continue;
    f.upliftPct = f.offRate > 0 ? Math.round(((f.onRate - f.offRate) / f.offRate) * 100) : null;
    f.confidence = proportionConfidence(f.off.goal, f.off.sessions, f.on.goal, f.on.sessions);
  }

  return { variants: results, factors, since: since.toISOString() };
}
