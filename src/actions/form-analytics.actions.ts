"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { FORM_STEPS } from "@/lib/form-steps";
import { parseDeviceString } from "@/lib/form-device";

// Conversion insight for the intake form: one round trip that answers "who
// converts, who does not, and exactly where the rest fall off".
//
// Rate convention: every *Rate value in here is a fraction between 0 and 1.
// The UI multiplies by 100 and prints one decimal. The two exceptions are
// upliftVsAverage and dropRateVsStep, which are already in percentage points
// (rounded to 1 decimal) because that is how they read on screen.

/** An "open" session nobody has touched for this long is really gone. */
const STALE_OPEN_MS = 30 * 60 * 1000;

/** Rows per breakdown table before the tail folds into a single "Other" row. */
const MAX_BREAKDOWN_ROWS = 12;

/** Rows per drill-down table before the tail folds into a single "Other" row. */
const MAX_DRILLDOWN_ROWS = 8;

/** A group has to be this much worse than the step average to get called out. */
const WORSE_THAN_AVERAGE_MARGIN = 0.1;

/** ...and it needs at least this many sessions before the gap means anything. */
const WORSE_THAN_AVERAGE_MIN_SESSIONS = 20;

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

/** One group of sessions inside a single step of the funnel. */
export interface StepDrilldownRow {
  value: string;
  /** Sessions in this group that got as far as this step. */
  reached: number;
  /** ...and carried on past it. */
  continued: number;
  /** ...and stopped here. */
  dropped: number;
  dropRate: number;
  /** This group's drop rate minus the step's drop rate, in percentage points. */
  dropRateVsStep: number;
  /** Meaningfully worse than the step average, on enough sessions to trust. */
  worseThanAverage: boolean;
}

export interface StepDrilldown {
  stepKey: string;
  stepLabel: string;
  /** The step that usually comes next. The form branches, so this is a hint. */
  nextStepLabel: string | null;
  dimension: string;
  dimensionLabel: string;
  reached: number;
  continued: number;
  dropped: number;
  dropRate: number;
  rows: StepDrilldownRow[];
  /** Sessions left out because they carry no value for this dimension. */
  unassigned: number;
}

/** A step where one group of sessions gave up. */
export interface GroupStepDrop {
  key: string;
  label: string;
  pitch: boolean;
  reached: number;
  dropped: number;
  /** Dropped over reached, inside this group. */
  dropRate: number;
  /** Share of all of this group's drop-offs that happened here. */
  shareOfDrops: number;
}

/** One value of a second dimension inside a group. */
export interface NestedSplitRow {
  value: string;
  sessions: number;
  completed: number;
  completionRate: number;
  reachedContact: number;
  contactRate: number;
}

export interface GroupDrilldown {
  dimension: string;
  dimensionLabel: string;
  value: string;
  sessions: number;
  completed: number;
  completionRate: number;
  reachedContact: number;
  contactRate: number;
  leads: number;
  /** The steps where this group stopped most often, biggest first. */
  topDropSteps: GroupStepDrop[];
  nestedDimension: string;
  nestedLabel: string;
  nestedRows: NestedSplitRow[];
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

interface ExperimentInfo {
  key: string;
  name: string;
  variantsJson: unknown;
}

/** Everything a report needs from one pass over the database. */
interface SessionContext {
  days: number;
  since: Date;
  /** Every session in the window, before the page filters are applied. */
  base: Enriched[];
  /** ...and the ones that match the page filters. */
  sessions: Enriched[];
  experiments: ExperimentInfo[];
}

/** How one dimension reads on screen and how it reads a session. */
interface Dimension {
  key: string;
  label: string;
  /** null means the session carries no value for this dimension. */
  pick: (s: Enriched) => string | null;
}

function label(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  return v === "" ? UNKNOWN : v;
}

function rate(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

/** A fraction difference turned into percentage points with one decimal. */
function points(delta: number): number {
  return Math.round(delta * 1000) / 10;
}

function median(values: number[] | undefined): number | null {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length / 2)] / 1000);
}

function allowedDays(days: number): number {
  return [7, 14, 30, 90].includes(days) ? days : 30;
}

/** The step a session stopped on, clamped to the steps we know about. */
function furthestStep(s: Enriched): number {
  return Math.min(s.furthestIndex, FORM_STEPS.length - 1);
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
      upliftVsAverage: points(completionRate - overallCompletionRate),
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
 * One pass over the sessions in the window, enriched and filtered.
 * Every report in this file starts here so the drill-downs always agree with
 * the numbers on the page.
 */
async function loadSessionContext(filters: AnalyticsFilters): Promise<SessionContext> {
  const days = allowedDays(Number(filters.days));
  const since = new Date(Date.now() - days * 86400000);
  const staleBefore = Date.now() - STALE_OPEN_MS;

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

  // Any experiment can have sessions attached, including one still in draft
  // that was briefly started, so take them all and let the data decide which
  // breakdowns are worth showing.
  const experiments: ExperimentInfo[] = await prisma.experiment.findMany({
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

  return { days, since, base, sessions, experiments };
}

/** The experiment a "variant" drill-down should use: the filtered one, else the busiest. */
function activeExperiment(
  experiments: ExperimentInfo[],
  sessions: Enriched[],
  filters: AnalyticsFilters
): ExperimentInfo | null {
  if (filters.experimentKey) {
    return experiments.find((e) => e.key === filters.experimentKey) ?? null;
  }
  let best: ExperimentInfo | null = null;
  let bestCount = 0;
  for (const e of experiments) {
    const count = sessions.reduce((n, s) => (s.variants[e.key] ? n + 1 : n), 0);
    if (count > bestCount) {
      best = e;
      bestCount = count;
    }
  }
  return bestCount > 0 ? best : null;
}

/** Turn a dimension name from the UI into something that can read a session. */
function resolveDimension(
  dimension: string,
  experiments: ExperimentInfo[],
  sessions: Enriched[],
  filters: AnalyticsFilters
): Dimension | null {
  switch (dimension) {
    case "device":
      return { key: "device", label: "Device", pick: (s) => s.device };
    case "browser":
      return { key: "browser", label: "Browser", pick: (s) => s.browser };
    case "os":
      return { key: "os", label: "OS", pick: (s) => s.os };
    case "country":
      return { key: "country", label: "Country", pick: (s) => s.country };
    case "timezone":
      return { key: "timezone", label: "Timezone", pick: (s) => s.timezone };
    case "utmSource":
      return { key: "utmSource", label: "UTM source", pick: (s) => s.utmSource };
    case "formVersion":
      return { key: "formVersion", label: "Form version", pick: (s) => s.formVersion };
    case "variant": {
      const exp = activeExperiment(experiments, sessions, filters);
      if (!exp) return null;
      return { key: "variant", label: exp.name, pick: (s) => s.variants[exp.key] ?? null };
    }
    default:
      break;
  }
  if (dimension.startsWith("experiment:")) {
    const key = dimension.slice("experiment:".length);
    const exp = experiments.find((e) => e.key === key);
    return { key: dimension, label: exp?.name ?? key, pick: (s) => s.variants[key] ?? null };
  }
  return null;
}

/** Values in the same order the breakdown tables use. */
function valuesByVolume(sessions: Enriched[], pick: (s: Enriched) => string | null): string[] {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const v = pick(s);
    if (v === null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([v]) => v);
}

/**
 * The sessions behind one breakdown row. "Other" is not a real value: it is the
 * folded tail of the table, so it maps back to every value past the cut.
 */
function membersOf(sessions: Enriched[], pick: (s: Enriched) => string | null, value: string): Enriched[] {
  const direct = sessions.filter((s) => pick(s) === value);
  if (value !== "Other" || direct.length > 0) return direct;
  const tail = new Set(valuesByVolume(sessions, pick).slice(MAX_BREAKDOWN_ROWS));
  if (tail.size === 0) return [];
  return sessions.filter((s) => {
    const v = pick(s);
    return v !== null && tail.has(v);
  });
}

/**
 * Everything the Conversion insight section shows, in one call.
 * Sessions started today count normally. A session still marked "open" whose
 * last heartbeat is more than 30 minutes old is treated as abandoned for the
 * rate math, because the visitor is not coming back to that tab.
 */
export async function getFormAnalytics(filters: AnalyticsFilters): Promise<FormAnalytics> {
  await requireAdmin();

  const { days, since, base, sessions, experiments } = await loadSessionContext(filters);

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
    const max = furthestStep(s);
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

/**
 * One step of the funnel, split by device, browser, OS, country, variant or UTM
 * source: who got here, who carried on, and who stopped. Same filters as the
 * page, same drop-off rule as the funnel, so the groups add up to the step.
 */
export async function getStepDrilldown(
  stepKey: string,
  dimension: string,
  filters: AnalyticsFilters
): Promise<StepDrilldown> {
  await requireAdmin();

  const { sessions, experiments } = await loadSessionContext(filters);

  const index = FORM_STEPS.findIndex((s) => s.key === stepKey);
  const step = index >= 0 ? FORM_STEPS[index] : null;
  const dim = resolveDimension(dimension, experiments, sessions, filters);

  const empty: StepDrilldown = {
    stepKey,
    stepLabel: step?.label ?? stepKey,
    nextStepLabel: index >= 0 ? (FORM_STEPS[index + 1]?.label ?? null) : null,
    dimension,
    dimensionLabel: dim?.label ?? dimension,
    reached: 0,
    continued: 0,
    dropped: 0,
    dropRate: 0,
    rows: [],
    unassigned: 0,
  };
  if (!step || !dim) return empty;

  // Everyone who got at least this far, and whether they stopped right here.
  const here = sessions.filter((s) => furthestStep(s) >= index);
  const stoppedHere = (s: Enriched) => !s.completed && furthestStep(s) === index;

  const reached = here.length;
  const dropped = here.filter(stoppedHere).length;
  const stepDropRate = rate(dropped, reached);

  const buckets = new Map<string, { reached: number; dropped: number }>();
  let unassigned = 0;
  for (const s of here) {
    const value = dim.pick(s);
    if (value === null) {
      unassigned++;
      continue;
    }
    const bucket = buckets.get(value) ?? { reached: 0, dropped: 0 };
    bucket.reached++;
    if (stoppedHere(s)) bucket.dropped++;
    buckets.set(value, bucket);
  }

  const sorted = Array.from(buckets.entries())
    .map(([value, b]) => ({ value, ...b }))
    .sort((a, b) => b.reached - a.reached || a.value.localeCompare(b.value));

  const head = sorted.slice(0, MAX_DRILLDOWN_ROWS);
  const tail = sorted.slice(MAX_DRILLDOWN_ROWS);
  if (tail.length > 0) {
    head.push({
      value: "Other",
      reached: tail.reduce((n, r) => n + r.reached, 0),
      dropped: tail.reduce((n, r) => n + r.dropped, 0),
    });
  }

  const rows: StepDrilldownRow[] = head.map((r) => {
    const dropRate = rate(r.dropped, r.reached);
    return {
      value: r.value,
      reached: r.reached,
      continued: Math.max(0, r.reached - r.dropped),
      dropped: r.dropped,
      dropRate,
      dropRateVsStep: points(dropRate - stepDropRate),
      worseThanAverage:
        r.reached >= WORSE_THAN_AVERAGE_MIN_SESSIONS && dropRate - stepDropRate >= WORSE_THAN_AVERAGE_MARGIN,
    };
  });

  return {
    ...empty,
    dimensionLabel: dim.label,
    reached,
    continued: Math.max(0, reached - dropped),
    dropped,
    dropRate: stepDropRate,
    rows,
    unassigned,
  };
}

/**
 * One breakdown row opened up: where that group of sessions gave up, and how
 * the group splits by a second dimension.
 */
export async function getGroupDrilldown(
  dimension: string,
  value: string,
  filters: AnalyticsFilters
): Promise<GroupDrilldown> {
  await requireAdmin();

  const { sessions, experiments } = await loadSessionContext(filters);
  const dim = resolveDimension(dimension, experiments, sessions, filters);
  const nestedKey = dimension === "device" ? "browser" : "device";
  const nested = resolveDimension(nestedKey, experiments, sessions, filters);

  const empty: GroupDrilldown = {
    dimension,
    dimensionLabel: dim?.label ?? dimension,
    value,
    sessions: 0,
    completed: 0,
    completionRate: 0,
    reachedContact: 0,
    contactRate: 0,
    leads: 0,
    topDropSteps: [],
    nestedDimension: nestedKey,
    nestedLabel: nested?.label ?? nestedKey,
    nestedRows: [],
  };
  if (!dim || !nested) return empty;

  const members = membersOf(sessions, dim.pick, value);
  if (members.length === 0) return empty;

  const completed = members.filter((s) => s.completed).length;
  const reachedContact = members.filter((s) => s.reachedContact).length;

  // Where this group stopped, using the same rule as the funnel.
  const reached = new Array(FORM_STEPS.length).fill(0);
  const stoppedAt = new Array(FORM_STEPS.length).fill(0);
  let totalDrops = 0;
  for (const s of members) {
    const max = furthestStep(s);
    for (let i = 0; i <= max; i++) reached[i]++;
    if (s.completed) continue;
    stoppedAt[max]++;
    totalDrops++;
  }

  const topDropSteps: GroupStepDrop[] = FORM_STEPS.map((st, i) => ({
    key: st.key,
    label: st.label,
    pitch: !!st.pitch,
    reached: reached[i],
    dropped: stoppedAt[i],
    dropRate: rate(stoppedAt[i], reached[i]),
    shareOfDrops: rate(stoppedAt[i], totalDrops),
  }))
    .filter((s) => s.dropped > 0)
    .sort((a, b) => b.dropped - a.dropped || b.dropRate - a.dropRate)
    .slice(0, 3);

  const nestedBuckets = new Map<string, { sessions: number; completed: number; reachedContact: number }>();
  for (const s of members) {
    const v = nested.pick(s);
    if (v === null) continue;
    const bucket = nestedBuckets.get(v) ?? { sessions: 0, completed: 0, reachedContact: 0 };
    bucket.sessions++;
    if (s.completed) bucket.completed++;
    if (s.reachedContact) bucket.reachedContact++;
    nestedBuckets.set(v, bucket);
  }

  const sortedNested = Array.from(nestedBuckets.entries())
    .map(([v, b]) => ({ value: v, ...b }))
    .sort((a, b) => b.sessions - a.sessions || a.value.localeCompare(b.value));
  const headNested = sortedNested.slice(0, MAX_DRILLDOWN_ROWS);
  const tailNested = sortedNested.slice(MAX_DRILLDOWN_ROWS);
  if (tailNested.length > 0) {
    headNested.push({
      value: "Other",
      sessions: tailNested.reduce((n, r) => n + r.sessions, 0),
      completed: tailNested.reduce((n, r) => n + r.completed, 0),
      reachedContact: tailNested.reduce((n, r) => n + r.reachedContact, 0),
    });
  }

  const nestedRows: NestedSplitRow[] = headNested.map((r) => ({
    value: r.value,
    sessions: r.sessions,
    completed: r.completed,
    completionRate: rate(r.completed, r.sessions),
    reachedContact: r.reachedContact,
    contactRate: rate(r.reachedContact, r.sessions),
  }));

  return {
    ...empty,
    dimensionLabel: dim.label,
    sessions: members.length,
    completed,
    completionRate: rate(completed, members.length),
    reachedContact,
    contactRate: rate(reachedContact, members.length),
    leads: members.filter((s) => s.hasLead).length,
    topDropSteps,
    nestedDimension: nested.key,
    nestedLabel: nested.label,
    nestedRows,
  };
}
