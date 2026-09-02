"use server";

import { prisma } from "@/lib/db";
import { FORM_STEPS, STEP_INDEX } from "@/lib/form-steps";

export interface FormFunnelData {
  days: number;
  sessions: number;
  reachedContact: number;
  completed: number;
  abandoned: number;
  steps: Array<{ key: string; label: string; pitch: boolean; reached: number; dropped: number; medianDwellSec: number | null }>;
  devices: Array<{ device: string; sessions: number; completed: number }>;
  pitchSkipRate: number | null;
}

/** Where visitors get to and where they leave, over the last N days. */
export async function getFormFunnel(days = 30): Promise<FormFunnelData> {
  const since = new Date(Date.now() - days * 86400000);
  const allSessions = await prisma.formSession.findMany({
    where: { startedAt: { gte: since } },
    select: { furthestIndex: true, furthestStep: true, outcome: true, reachedContact: true, device: true, sessionId: true, leadId: true },
  });
  // Sessions that became an archived lead are out of every number.
  const linkedIds = allSessions.map((s) => s.leadId).filter((x): x is string => !!x);
  const archivedLeads = linkedIds.length
    ? new Set((await prisma.lead.findMany({ where: { id: { in: linkedIds }, status: "ARCHIVED" }, select: { id: true } })).map((l) => l.id))
    : new Set<string>();
  const sessions = allSessions.filter((s) => !s.leadId || !archivedLeads.has(s.leadId));

  const total = sessions.length;
  const completed = sessions.filter((s) => s.outcome === "completed").length;
  const abandoned = sessions.filter((s) => s.outcome === "abandoned").length;
  const reachedContact = sessions.filter((s) => s.reachedContact).length;

  // Reached counts: a session "reached" every step up to its furthest index.
  const reached = new Array(FORM_STEPS.length).fill(0);
  for (const s of sessions) {
    const max = Math.max(0, s.furthestIndex);
    for (let i = 0; i <= max && i < reached.length; i++) reached[i]++;
  }

  // Median dwell per step from step_exit events
  const exits = await prisma.formEvent.findMany({
    where: { at: { gte: since }, type: "step_exit" },
    select: { step: true, metaJson: true },
    take: 50000,
  });
  const dwell: Record<string, number[]> = {};
  for (const e of exits) {
    const ms = (e.metaJson as { dwell_ms?: number } | null)?.dwell_ms;
    if (e.step && typeof ms === "number" && ms > 0 && ms < 30 * 60000) (dwell[e.step] ??= []).push(ms);
  }
  const median = (arr: number[] | undefined) => {
    if (!arr || arr.length === 0) return null;
    const s = [...arr].sort((a, b) => a - b);
    return Math.round(s[Math.floor(s.length / 2)] / 1000);
  };

  const steps = FORM_STEPS.map((st, i) => ({
    key: st.key,
    label: st.label,
    pitch: !!st.pitch,
    reached: reached[i],
    dropped: i + 1 < reached.length ? Math.max(0, reached[i] - reached[i + 1]) : 0,
    medianDwellSec: median(dwell[st.key]),
  })).filter((s) => s.reached > 0 || s.key === "intro");

  const byDevice: Record<string, { sessions: number; completed: number }> = {};
  for (const s of sessions) {
    const d = (s.device ?? "Unknown").split("/")[0].trim() || "Unknown";
    byDevice[d] ??= { sessions: 0, completed: 0 };
    byDevice[d].sessions++;
    if (s.outcome === "completed") byDevice[d].completed++;
  }
  const devices = Object.entries(byDevice).map(([device, v]) => ({ device, ...v })).sort((a, b) => b.sessions - a.sessions).slice(0, 5);

  // Pitch skip: sessions where a pitch view was followed within 2s by an exit.
  const pitchExits = exits.filter((e) => e.step && FORM_STEPS[STEP_INDEX[e.step] ?? -1]?.pitch);
  const quick = pitchExits.filter((e) => ((e.metaJson as { dwell_ms?: number } | null)?.dwell_ms ?? 99999) < 2000).length;
  const pitchSkipRate = pitchExits.length > 0 ? Math.round((quick / pitchExits.length) * 100) : null;

  return { days, sessions: total, reachedContact, completed, abandoned, steps, devices, pitchSkipRate };
}
