"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { FORM_STEPS } from "@/lib/form-steps";
import { parseDeviceString } from "@/lib/form-device";

// Conversion insight for the intake form: one round trip that answers "who
// converts, who does not, and exactly where the rest fall off".
//
// Rate convention: every *Rate value in here is a fraction between 0 and 1.
// The UI multiplies by 100 and prints one decimal. The one exception is
// upliftVsAverage, which is already in percentage points (rounded to 1 decimal)
// because that is how it reads on screen.

/** An "open" session nobody has touched for this long is really gone. */
const STALE_OPEN_MS = 30 * 60 * 1000;

/** Rows per breakdown table before the tail folds into a single "Other" row. */
const MAX_BREAKDOWN_ROWS = 12;

const UNKNOWN = "Unknown";

export interface AnalyticsFilters {
  days: number;
  device?: string;
  browser?: string;
  os?: string;
  country?: string;
  variantKey?: string;
  experimentKey?: string;
  utmSource?: string;
}

export interface AnalyticsTotals {
  sessions: number;
  reachedContact: number;
  completed: number;
  abandoned: number;
  stillOpen: number;
  becameLead: number;
  hotLeads: number;
  completionRate: number;
  contactRate: number;
}

export interface StepStat {
  key: string;
  label: string;
  pitch: boolean;
  reached: number;
  /** Reached the next step in the flow. */
  completedStep: number;
  dropped: number;
  dropRate: number;
  medianDwellSec: number | null;
}

export interface BreakdownRow {
  value: string;
  sessions: number;
  completed: number;
  completionRate: number;
  reachedContact: number;
  contactRate: number;
  leads: number;
  /** This row's completion rate minus the overall rate, in percentage points. */
  upliftVsAverage: number;
}

export interface Breakdown {
  dimension: string;
  label: string;
  rows: BreakdownRow[];
}

export interface WorstStep {
  key: string;
  label: string;
  pitch: boolean;
  dropped: number;
  dropRate: number;
  /** The device/browser pairs most common among the people who left here. */
  topCombos: Array<{ combo: string; count: number }>;
}

export interface StepErrorStat {
  step: string;
  label: string;
  count: number;
}

export interface FilterOptions {
  devices: string[];
  browsers: string[];
  oses: string[];
  countries: string[];
  utmSources: string[];
  experiments: Array<{ key: string; name: string; variants: string[] }>;
}

export interface FormAnalytics {
  days: number;
  totals: AnalyticsTotals;
  steps: StepStat[];
  breakdowns: Breakdown[];
  worstSteps: WorstStep[];
  errors: StepErrorStat[];
  filterOptions: FilterOptions;
  generatedAt: string;
}

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") throw new Error("Unauthorized");
  return session;
}

/** One session with everything the grouping needs already worked out. */
interface Enriched {
  sessionId: string;
  device: string;
  browser: string;
  os: string;
  country: string;
  timezone: string;
  utmSource: string;
  formVersion: string;
  variants: Record<string, string>;
  furthestIndex: number;
  reachedContact: boolean;
  /** "open" | "completed" | "abandoned", with stale opens counted as abandoned. */
  outcome: string;
  completed: boolean;
  hasLead: boolean;
  isHot: boolean;
}

function label(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  return v === "" ? UNKNOWN : v;
}

function rate(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

function median(values: number[] | undefined): number | null {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length / 2)] / 1000);
}

function allowedDays(days: number): number {
  return [7, 14, 30, 90].includes(days) ? days : 30;
}

/** Sessions grouped by one field, sorted by volume, long tail folded into "Other". */
function buildBreakdown(
  dimension: string,
  dimensionLabel: string,
  sessions: Enriched[],
  pick: (s: Enriched) => string | null,
  overallCompletionRate: number
): Breakdown {
  const buckets = new Map<string, { sessions: number; completed: number; reachedContact: number; leads: number }>();
  for (const s of sessions) {
    const value = pick(s);
    if (value === null) continue;
    const bucket = buckets.get(value) ?? { sessions: 0, completed: 0, reachedContact: 0, leads: 0 };
    bucket.sessions++;
    if (s.completed) bucket.completed++;
    if (s.reachedContact) bucket.reachedContact++;
    if (s.hasLead) bucket.leads++;
    buckets.set(value, bucket);
  }

  const sorted = Array.from(buckets.entries())
    .map(([value, b]) => ({ value, ...b }))
    .sort((a, b) => b.sessions - a.sessions || a.value.localeCompare(b.value));

  const head = sorted.slice(0, MAX_BREAKDOWN_ROWS);
  const tail = sorted.slice(MAX_BREAKDOWN_ROWS);
  if (tail.length > 0) {
    head.push({
      value: "Other",
      sessions: tail.reduce((n, r) => n + r.sessions, 0),
      completed: tail.reduce((n, r) => n + r.completed, 0),
      reachedContact: tail.reduce((n, r) => n + r.reachedContact, 0),
      leads: tail.reduce((n, r) => n + r.leads, 0),
    });
  }

  const rows: BreakdownRow[] = head.map((r) => {
    const completionRate = rate(r.completed, r.sessions);
    return {
      value: r.value,
      sessions: r.sessions,
      completed: r.completed,
      completionRate,
      reachedContact: r.reachedContact,
      contactRate: rate(r.reachedContact, r.sessions),
      leads: r.leads,
      upliftVsAverage: Math.round((completionRate - overallCompletionRate) * 1000) / 10,
    };
  });

  return { dimension, label: dimensionLabel, rows };
}

/** Distinct values in volume order, for the filter dropdowns. */
function distinct(sessions: Enriched[], pick: (s: Enriched) => string): string[] {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const v = pick(s);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([v]) => v);
}

/**
 * Everything the Conversion insight section shows, in one call.
 * Sessions started today count normally. A session still marked "open" whose
 * last heartbeat is more than 30 minutes old is treated as abandoned for the
 * rate math, because the visitor is not coming back to that tab.
 */
export async function getFormAnalytics(filters: AnalyticsFilters): Promise<FormAnalytics> {
  await requireAdmin();

  const days = allowedDays(Number(filters.days));
  const since = new Date(Date.now() - days * 86400000);
  const staleBefore = Date.now() - STALE_OPEN_MS;

  // One pass over the sessions in the window; all grouping happens in memory.
  const rows = await prisma.formSession.findMany({
    where: { startedAt: { gte: since } },
    select: {
      sessionId: true,
      lastSeenAt: true,
      formVersion: true,
      variantsJson: true,
      utmSource: true,
      device: true,
      timezone: true,
      geoCountry: true,
      furthestIndex: true,
      reachedContact: true,
      outcome: true,
      leadId: true,
    },
  });

  // Archived and merged leads are out of every number, and so are the sessions
  // that produced them.
  const linkedIds = Array.from(new Set(rows.map((r) => r.leadId).filter((id): id is string => !!id)));
  const leads = linkedIds.length
    ? await prisma.lead.findMany({
        where: { id: { in: linkedIds } },
        select: { id: true, qualityTier: true, status: true },
      })
    : [];
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const excludedLeads = new Set(leads.filter((l) => l.status === "ARCHIVED" || l.status === "MERGED").map((l) => l.id));

  const { getTierRanges } = await import("@/actions/status.actions");
  const tiers = await getTierRanges();
  const hotTiers = new Set(tiers.slice(0, 2).map((t) => t.name));

  const experiments = await prisma.experiment.findMany({
    where: { status: { in: ["running", "ended"] } },
    select: { key: true, name: true, variantsJson: true },
    orderBy: { createdAt: "desc" },
  });

  const base: Enriched[] = [];
  for (const r of rows) {
    if (r.leadId && excludedLeads.has(r.leadId)) continue;
    const parts = parseDeviceString(r.device);
    const lead = r.leadId ? leadById.get(r.leadId) : undefined;
    const stale = r.outcome === "open" && r.lastSeenAt.getTime() < staleBefore;
    const outcome = stale ? "abandoned" : r.outcome;
    base.push({
      sessionId: r.sessionId,
      device: label(parts.device),
      browser: label(parts.browser),
      os: label(parts.os),
      country: label(r.geoCountry),
      timezone: label(r.timezone),
      utmSource: label(r.utmSource),
      formVersion: label(r.formVersion),
      variants: (r.variantsJson as Record<string, string> | null) ?? {},
      furthestIndex: Math.max(0, r.furthestIndex),
      reachedContact: r.reachedContact,
      outcome,
      completed: r.outcome === "completed",
      hasLead: !!lead,
      isHot: !!lead?.qualityTier && hotTiers.has(lead.qualityTier),
    });
  }

  // Filter options come from the window before any other filter is applied, so
  // a narrow selection never empties the dropdowns.
  const filterOptions: FilterOptions = {
    devices: distinct(base, (s) => s.device),
    browsers: distinct(base, (s) => s.browser),
    oses: distinct(base, (s) => s.os),
    countries: distinct(base, (s) => s.country),
    utmSources: distinct(base, (s) => s.utmSource),
    experiments: experiments.map((e) => {
      const defined = ((e.variantsJson as Array<{ key?: string }> | null) ?? [])
        .map((v) => (v?.key ?? "").trim())
        .filter(Boolean);
      const seen = new Set(base.map((s) => s.variants[e.key]).filter((v): v is string => !!v));
      for (const v of defined) seen.add(v);
      return { key: e.key, name: e.name, variants: Array.from(seen).sort() };
    }),
  };

  const sessions = base.filter((s) => {
    if (filters.device && s.device !== filters.device) return false;
    if (filters.browser && s.browser !== filters.browser) return false;
    if (filters.os && s.os !== filters.os) return false;
    if (filters.country && s.country !== filters.country) return false;
    if (filters.utmSource && s.utmSource !== filters.utmSource) return false;
    if (filters.experimentKey) {
      const assigned = s.variants[filters.experimentKey];
      if (!assigned) return false;
      if (filters.variantKey && assigned !== filters.variantKey) return false;
    } else if (filters.variantKey) {
      if (!Object.values(s.variants).includes(filters.variantKey)) return false;
    }
    return true;
  });

  const totals: AnalyticsTotals = {
    sessions: sessions.length,
    reachedContact: sessions.filter((s) => s.reachedContact).length,
    completed: sessions.filter((s) => s.completed).length,
    abandoned: sessions.filter((s) => s.outcome === "abandoned").length,
    stillOpen: sessions.filter((s) => s.outcome === "open").length,
    becameLead: sessions.filter((s) => s.hasLead).length,
    hotLeads: sessions.filter((s) => s.isHot).length,
    completionRate: 0,
    contactRate: 0,
  };
  totals.completionRate = rate(totals.completed, totals.sessions);
  totals.contactRate = rate(totals.reachedContact, totals.sessions);

  // A session reached every step up to its furthest index.
  const reached = new Array(FORM_STEPS.length).fill(0);
  // Where each unfinished visitor actually stopped. The form branches, so the
  // gap between one step's reach and the next one's is partly people taking a
  // different path; counting the step someone's session ended on is the only
  // number that answers "where do people give up".
  const stoppedAt = new Array(FORM_STEPS.length).fill(0);
  const droppersAt = new Map<number, Enriched[]>();
  for (const s of sessions) {
    const max = Math.min(s.furthestIndex, FORM_STEPS.length - 1);
    for (let i = 0; i <= max; i++) reached[i]++;
    if (s.completed) continue;
    stoppedAt[max]++;
    const list = droppersAt.get(max);
    if (list) list.push(s);
    else droppersAt.set(max, [s]);
  }

  // Median seconds per step, from the step_exit events in the same window.
  const sessionIds = new Set(sessions.map((s) => s.sessionId));
  const exits = await prisma.formEvent.findMany({
    where: { at: { gte: since }, type: "step_exit" },
    select: { sessionId: true, step: true, metaJson: true },
    take: 50000,
  });
  const dwell: Record<string, number[]> = {};
  for (const e of exits) {
    if (!e.step || !sessionIds.has(e.sessionId)) continue;
    const ms = (e.metaJson as { dwell_ms?: number } | null)?.dwell_ms;
    if (typeof ms === "number" && ms > 0 && ms < 30 * 60000) (dwell[e.step] ??= []).push(ms);
  }

  const steps: StepStat[] = FORM_STEPS.map((st, i) => {
    const reachedHere = reached[i];
    const dropped = stoppedAt[i];
    const completedStep = Math.max(0, reachedHere - dropped);
    return {
      key: st.key,
      label: st.label,
      pitch: !!st.pitch,
      reached: reachedHere,
      completedStep,
      dropped,
      dropRate: rate(dropped, reachedHere),
      medianDwellSec: median(dwell[st.key]),
    };
  }).filter((s) => s.reached > 0);

  const worstSteps: WorstStep[] = [...steps]
    .filter((s) => s.dropped > 0)
    .sort((a, b) => b.dropped - a.dropped || b.dropRate - a.dropRate)
    .slice(0, 5)
    .map((s) => {
      const index = FORM_STEPS.findIndex((st) => st.key === s.key);
      const combos = new Map<string, number>();
      for (const d of droppersAt.get(index) ?? []) {
        const combo = `${d.device} / ${d.browser}`;
        combos.set(combo, (combos.get(combo) ?? 0) + 1);
      }
      return {
        key: s.key,
        label: s.label,
        pitch: s.pitch,
        dropped: s.dropped,
        dropRate: s.dropRate,
        topCombos: Array.from(combos.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 2)
          .map(([combo, count]) => ({ combo, count })),
      };
    });

  // The form may not emit validation_error events yet; an empty list is fine.
  const errorEvents = await prisma.formEvent.findMany({
    where: { at: { gte: since }, type: "validation_error" },
    select: { sessionId: true, step: true },
    take: 20000,
  });
  const errorCounts = new Map<string, number>();
  for (const e of errorEvents) {
    if (!sessionIds.has(e.sessionId)) continue;
    const key = e.step ?? UNKNOWN;
    errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
  }
  const errors: StepErrorStat[] = Array.from(errorCounts.entries())
    .map(([step, count]) => ({ step, label: FORM_STEPS.find((s) => s.key === step)?.label ?? step, count }))
    .sort((a, b) => b.count - a.count);

  const avg = totals.completionRate;
  const breakdowns: Breakdown[] = [
    buildBreakdown("device", "Device", sessions, (s) => s.device, avg),
    buildBreakdown("browser", "Browser", sessions, (s) => s.browser, avg),
    buildBreakdown("os", "OS", sessions, (s) => s.os, avg),
    buildBreakdown("country", "Country", sessions, (s) => s.country, avg),
    buildBreakdown("timezone", "Timezone", sessions, (s) => s.timezone, avg),
    buildBreakdown("utmSource", "UTM source", sessions, (s) => s.utmSource, avg),
    buildBreakdown("formVersion", "Form version", sessions, (s) => s.formVersion, avg),
    ...experiments.map((e) =>
      // Only sessions actually enrolled in the experiment show up here.
      buildBreakdown(`experiment:${e.key}`, e.name, sessions, (s) => s.variants[e.key] ?? null, avg)
    ),
  ];

  return {
    days,
    totals,
    steps,
    breakdowns,
    worstSteps,
    errors,
    filterOptions,
    generatedAt: new Date().toISOString(),
  };
}
