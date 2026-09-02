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

function zToConfidence(z: number): number {
  // Two-sided normal CDF approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  const twoSided = 2 * p;
  return Math.round((1 - twoSided) * 100);
}

/** Per-variant funnel and downstream lead outcomes for one experiment. */
export async function getExperimentResults(experimentId: string): Promise<{ variants: VariantResult[]; since: string | null }> {
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
  const { getTierRanges } = await import("@/actions/status.actions");
  const tiers = await getTierRanges();
  const hot = new Set(tiers.slice(0, 2).map((t) => t.name));

  const results: VariantResult[] = defs.map((v) => ({
    key: v.key, sessions: 0, reachedContact: 0, completed: 0, leads: 0, hotLeads: 0, contacted: 0, won: 0, goalRate: 0, upliftPct: null, confidence: null,
  }));
  const byKey = new Map(results.map((r) => [r.key, r]));
  for (const s of sessions) {
    const vk = (s.variantsJson as Record<string, string> | null)?.[exp.key];
    const r = vk ? byKey.get(vk) : undefined;
    if (!r) continue;
    r.sessions++;
    if (s.reachedContact) r.reachedContact++;
    if (s.outcome === "completed") r.completed++;
    const lead = s.leadId ? leadById.get(s.leadId) : undefined;
    if (lead) {
      r.leads++;
      if (lead.qualityTier && hot.has(lead.qualityTier)) r.hotLeads++;
      if (lead.firstContactAt) r.contacted++;
      if (lead.status === "WON") r.won++;
    }
  }
  const goalOf = (r: VariantResult) => exp.primaryGoal === "contact_reached" ? r.reachedContact : exp.primaryGoal === "hot_lead" ? r.hotLeads : r.completed;
  for (const r of results) r.goalRate = r.sessions ? goalOf(r) / r.sessions : 0;
  const control = results[0];
  for (const r of results.slice(1)) {
    if (!control || control.sessions === 0 || r.sessions === 0) continue;
    r.upliftPct = control.goalRate > 0 ? Math.round(((r.goalRate - control.goalRate) / control.goalRate) * 100) : null;
    const p1 = control.goalRate, p2 = r.goalRate, n1 = control.sessions, n2 = r.sessions;
    const pooled = (goalOf(control) + goalOf(r)) / (n1 + n2);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
    r.confidence = se > 0 ? zToConfidence((p2 - p1) / se) : null;
  }
  return { variants: results, since: since.toISOString() };
}
