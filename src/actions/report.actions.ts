"use server";

import { prisma } from "@/lib/db";
import { normalizeState } from "@/lib/us-states";
import { toEstDateString } from "@/lib/timezone";

interface DateRange {
  from: Date;
  to: Date;
}

function buildWhere(range: DateRange | null) {
  if (!range) return {};
  return { createdAt: { gte: range.from, lte: range.to } };
}

function prevPeriod(range: DateRange | null): DateRange | null {
  if (!range) return null;
  const diff = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - diff), to: new Date(range.from.getTime()) };
}

export async function getReportKPIs(range: DateRange | null) {
  const where = buildWhere(range);
  const prevWhere = buildWhere(prevPeriod(range));

  const [total, prevTotal, avgScore, prevAvgScore, contacted, prevContacted, leads] = await Promise.all([
    prisma.lead.count({ where: { ...where, status: { not: "ARCHIVED" } } }),
    prisma.lead.count({ where: { ...prevWhere, status: { not: "ARCHIVED" } } }),
    prisma.lead.aggregate({ where: { ...where, status: { not: "ARCHIVED" } }, _avg: { score: true } }),
    prisma.lead.aggregate({ where: { ...prevWhere, status: { not: "ARCHIVED" } }, _avg: { score: true } }),
    // Contacted: a recorded first contact, which includes referring the lead out.
    prisma.lead.count({ where: { ...where, status: { not: "ARCHIVED" }, OR: [{ firstContactAt: { not: null } }, { status: { in: ["CONTACTED", "QUALIFIED", "REFERRED_OUT", "WON"] } }] } }),
    prisma.lead.count({ where: { ...prevWhere, status: { not: "ARCHIVED" }, OR: [{ firstContactAt: { not: null } }, { status: { in: ["CONTACTED", "QUALIFIED", "REFERRED_OUT", "WON"] } }] } }),
    prisma.lead.findMany({ where: { ...where, status: { not: "ARCHIVED" } }, select: { accountVolume: true } }),
  ]);

  const units = leads.reduce((s, l) => s + (parseInt(l.accountVolume ?? "0", 10) || 0), 0);

  const contactRate = total > 0 ? Math.round((contacted / total) * 100) : 0;
  const prevContactRate = prevTotal > 0 ? Math.round((prevContacted / prevTotal) * 100) : 0;

  return {
    totalLeads: total,
    prevTotalLeads: prevTotal,
    avgScore: Math.round(avgScore._avg.score ?? 0),
    prevAvgScore: Math.round(prevAvgScore._avg.score ?? 0),
    contactRate,
    prevContactRate,
    estUnits: units,
  };
}

export async function getLeadVolumeByDay(range: DateRange | null) {
  const where = buildWhere(range);
  const leads = await prisma.lead.findMany({
    where: { ...where, status: { not: "ARCHIVED" } },
    select: { createdAt: true, qualityTier: true },
    orderBy: { createdAt: "asc" },
  });

  const buckets: Record<string, { date: string; total: number; [tier: string]: number | string }> = {};
  const allTiers = new Set<string>();
  for (const lead of leads) {
    const day = toEstDateString(lead.createdAt);
    if (!buckets[day]) buckets[day] = { date: day, total: 0 };
    buckets[day].total++;
    const tier = lead.qualityTier ?? "Unknown";
    allTiers.add(tier);
    buckets[day][tier] = ((buckets[day][tier] as number) || 0) + 1;
  }

  // Fill gaps: ensure every date between first and last has an entry
  const days = Object.keys(buckets).sort();
  if (days.length >= 2) {
    const start = new Date(days[0] + "T12:00:00");
    const end = new Date(days[days.length - 1] + "T12:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      if (!buckets[key]) {
        const entry: Record<string, number | string> = { date: key, total: 0 };
        for (const tier of allTiers) entry[tier] = 0;
        buckets[key] = entry as { date: string; total: number; [tier: string]: number | string };
      } else {
        // Ensure all tiers present on every day (0 if missing)
        for (const tier of allTiers) {
          if (!(tier in buckets[key])) buckets[key][tier] = 0;
        }
      }
    }
  }

  return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getTierDistribution(range: DateRange | null) {
  const where = buildWhere(range);
  const results = await prisma.lead.groupBy({
    by: ["qualityTier"],
    where: { ...where, status: { not: "ARCHIVED" }, qualityTier: { not: null } },
    _count: { id: true },
  });
  return results.map((r) => ({ tier: r.qualityTier ?? "Unknown", count: r._count.id }));
}

export async function getStatusBreakdown(range: DateRange | null) {
  const where = buildWhere(range);
  const results = await prisma.lead.groupBy({
    by: ["status"],
    where: { ...where, status: { not: "ARCHIVED" } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });
  return results.map((r) => ({ status: r.status, count: r._count.id }));
}

export async function getLeadsByState(range: DateRange | null) {
  const where = buildWhere(range);
  const leads = await prisma.lead.findMany({
    where: { ...where, status: { not: "ARCHIVED" } },
    select: { state: true, states: true, accountVolume: true },
  });

  const map: Record<string, { count: number; units: number }> = {};
  for (const lead of leads) {
    const units = parseInt(lead.accountVolume ?? "0", 10) || 0;
    // Use states JSON array if available, otherwise fall back to single state
    const statesArr = (lead.states as string[] | null) ?? (lead.state ? [lead.state] : []);
    for (const s of statesArr) {
      const normalized = normalizeState(s) || s;
      if (!normalized) continue;
      if (!map[normalized]) map[normalized] = { count: 0, units: 0 };
      map[normalized].count++;
      map[normalized].units += units;
    }
  }

  return Object.entries(map)
    .map(([state, data]) => ({ state, ...data }))
    .sort((a, b) => b.count - a.count);
}

export async function getLeadSources(range: DateRange | null) {
  const where = buildWhere(range);
  const leads = await prisma.lead.findMany({
    where: { ...where, status: { not: "ARCHIVED" } },
    select: { referrer: true, utmSource: true, utmMedium: true },
  });

  const buckets: Record<string, number> = {};
  for (const lead of leads) {
    const ref = lead.referrer ?? "";
    const utm = lead.utmMedium ?? "";
    let category = "Direct";

    if (ref.includes("google") && (utm.includes("cpc") || ref.includes("gclid"))) {
      category = "Google (ads)";
    } else if (ref.includes("google")) {
      category = "Google (organic)";
    } else if (ref.includes("facebook") || ref.includes("instagram") || ref.includes("linkedin")) {
      category = "Social Media";
    } else if (ref === "(Direct visit)" || ref === "" || ref === "direct") {
      category = "Direct";
    } else if (ref) {
      category = "Other";
    }

    buckets[category] = (buckets[category] || 0) + 1;
  }

  return Object.entries(buckets)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getPipelineFunnel(range: DateRange | null) {
  const where = buildWhere(range);
  const [newCount, contacted, qualified, won, lost, disqualified] = await Promise.all([
    prisma.lead.count({ where: { ...where, status: { not: "ARCHIVED" } } }),
    prisma.lead.count({ where: { ...where, status: { in: ["CONTACTED", "QUALIFIED", "FOLLOW_UP_NEEDED", "REFERRED_OUT", "IMPORTED_TO_CRM", "WON", "LOST"] } } }),
    prisma.lead.count({ where: { ...where, status: { in: ["QUALIFIED", "IMPORTED_TO_CRM", "WON"] } } }),
    prisma.lead.count({ where: { ...where, status: "WON" } }),
    prisma.lead.count({ where: { ...where, status: "LOST" } }),
    prisma.lead.count({ where: { ...where, status: "DISQUALIFIED" } }),
  ]);
  return { new: newCount, contacted, qualified, won, lost, disqualified };
}

export async function getAvgScoreOverTime(range: DateRange | null) {
  const where = buildWhere(range);
  const leads = await prisma.lead.findMany({
    where: { ...where, score: { not: null }, status: { not: "ARCHIVED" } },
    select: { createdAt: true, score: true },
    orderBy: { createdAt: "asc" },
  });

  const daily: Record<string, { sum: number; count: number }> = {};
  for (const lead of leads) {
    const day = toEstDateString(lead.createdAt);
    if (!daily[day]) daily[day] = { sum: 0, count: 0 };
    daily[day].sum += lead.score ?? 0;
    daily[day].count++;
  }

  return Object.entries(daily).map(([date, d]) => ({
    date,
    avgScore: Math.round(d.sum / d.count),
  }));
}

export async function getScoringRuleEffectiveness(range: DateRange | null) {
  const where = buildWhere(range);
  const leads = await prisma.lead.findMany({
    where: { ...where, scoreReasons: { not: undefined }, status: { not: "ARCHIVED" } },
    select: { scoreReasons: true },
  });

  const ruleStats: Record<string, { matched: number; totalImpact: number }> = {};
  const totalLeads = leads.length;

  for (const lead of leads) {
    const reasons = lead.scoreReasons as Array<{ ruleName: string; scoreAdjustment: number }> | null;
    if (!reasons) continue;
    for (const r of reasons) {
      if (!ruleStats[r.ruleName]) ruleStats[r.ruleName] = { matched: 0, totalImpact: 0 };
      ruleStats[r.ruleName].matched++;
      ruleStats[r.ruleName].totalImpact += r.scoreAdjustment;
    }
  }

  return Object.entries(ruleStats)
    .map(([name, s]) => ({
      name,
      matched: s.matched,
      avgImpact: s.matched > 0 ? Math.round((s.totalImpact / s.matched) * 10) / 10 : 0,
      pctOfLeads: totalLeads > 0 ? Math.round((s.matched / totalLeads) * 100) : 0,
    }))
    .sort((a, b) => b.matched - a.matched);
}

export async function getRecentLeads(limit: number = 10) {
  const leads = await prisma.lead.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: {
      id: true, createdAt: true, companyName: true, fullName: true,
      score: true, qualityTier: true, status: true, accountVolume: true, state: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return leads.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }));
}

export async function getTopLeadsByScore(range: DateRange | null, limit: number = 10) {
  const where = buildWhere(range);
  const leads = await prisma.lead.findMany({
    where: { ...where, score: { not: null }, status: { not: "ARCHIVED" } },
    select: {
      id: true, companyName: true, fullName: true, score: true,
      qualityTier: true, accountVolume: true, status: true,
    },
    orderBy: { score: "desc" },
    take: limit,
  });
  return leads;
}

export async function getFollowUpLeads() {
  const leads = await prisma.lead.findMany({
    where: { status: "FOLLOW_UP_NEEDED" },
    select: {
      id: true, companyName: true, fullName: true, lastActivityAt: true, createdAt: true,
    },
    orderBy: { lastActivityAt: "asc" },
    take: 10,
  });
  return leads.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    lastActivityAt: l.lastActivityAt?.toISOString() ?? null,
    daysSince: l.lastActivityAt
      ? Math.floor((Date.now() - l.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24))
      : Math.floor((Date.now() - l.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
  }));
}

export async function getResponseTime(range: DateRange | null) {
  const where = buildWhere(range);
  const events = await prisma.leadEvent.findMany({
    where: {
      eventType: "status_changed",
      lead: { ...where, status: { not: "ARCHIVED" } },
    },
    select: { leadId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Get the creation times
  const leadIds = [...new Set(events.map((e) => e.leadId))];
  if (leadIds.length === 0) return { avgHours: 0, distribution: [] };

  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: { id: true, createdAt: true },
  });
  const creationMap = Object.fromEntries(leads.map((l) => [l.id, l.createdAt]));

  // First status change per lead
  const firstChange: Record<string, Date> = {};
  for (const e of events) {
    if (!firstChange[e.leadId]) firstChange[e.leadId] = e.createdAt;
  }

  const hours: number[] = [];
  for (const [leadId, changeTime] of Object.entries(firstChange)) {
    const created = creationMap[leadId];
    if (!created) continue;
    hours.push((changeTime.getTime() - created.getTime()) / (1000 * 60 * 60));
  }

  if (hours.length === 0) return { avgHours: 0, distribution: [] };

  const avg = hours.reduce((s, h) => s + h, 0) / hours.length;
  const dist = [
    { label: "<1h", count: hours.filter((h) => h < 1).length },
    { label: "1-4h", count: hours.filter((h) => h >= 1 && h < 4).length },
    { label: "4-12h", count: hours.filter((h) => h >= 4 && h < 12).length },
    { label: "12-24h", count: hours.filter((h) => h >= 12 && h < 24).length },
    { label: "24h+", count: hours.filter((h) => h >= 24).length },
  ];

  return { avgHours: Math.round(avg * 10) / 10, distribution: dist };
}

export async function getUnitDistribution(range: DateRange | null) {
  const where = buildWhere(range);
  const leads = await prisma.lead.findMany({
    where: { ...where, accountVolume: { not: null }, status: { not: "ARCHIVED" } },
    select: { accountVolume: true },
  });

  const buckets = [
    { label: "1-50", min: 1, max: 50, count: 0 },
    { label: "51-100", min: 51, max: 100, count: 0 },
    { label: "101-250", min: 101, max: 250, count: 0 },
    { label: "251-500", min: 251, max: 500, count: 0 },
    { label: "501-1000", min: 501, max: 1000, count: 0 },
    { label: "1000+", min: 1001, max: Infinity, count: 0 },
  ];

  for (const lead of leads) {
    const units = parseInt(lead.accountVolume ?? "0", 10);
    if (isNaN(units) || units <= 0) continue;
    for (const bucket of buckets) {
      if (units >= bucket.min && units <= bucket.max) { bucket.count++; break; }
    }
  }

  return buckets.map((b) => ({ label: b.label, count: b.count }));
}

export async function getRentDistribution(range: DateRange | null) {
  const where = buildWhere(range);
  const leads = await prisma.lead.findMany({
    where: { ...where, status: { not: "ARCHIVED" } },
    select: { rawPayloadJson: true },
  });

  const buckets = [
    { label: "<$1,000", min: 0, max: 999, count: 0 },
    { label: "$1,000-1,500", min: 1000, max: 1500, count: 0 },
    { label: "$1,500-2,000", min: 1501, max: 2000, count: 0 },
    { label: "$2,000-3,000", min: 2001, max: 3000, count: 0 },
    { label: "$3,000-5,000", min: 3001, max: 5000, count: 0 },
    { label: "$5,000+", min: 5001, max: Infinity, count: 0 },
  ];

  for (const lead of leads) {
    const raw = lead.rawPayloadJson as Record<string, unknown> | null;
    const intake = (raw?._rawIntakeForm as Record<string, unknown>) ?? raw;
    const rent = Number(intake?.avgRent);
    if (isNaN(rent) || rent <= 0) continue;
    for (const bucket of buckets) {
      if (rent >= bucket.min && rent <= bucket.max) { bucket.count++; break; }
    }
  }

  return buckets.map((b) => ({ label: b.label, count: b.count }));
}

export async function getRecentActivity(limit: number = 20) {
  const events = await prisma.leadEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { name: true } },
      lead: { select: { id: true, companyName: true, fullName: true } },
    },
  });

  return events.map((e) => ({
    id: e.id,
    leadId: e.lead?.id ?? "",
    leadName: e.lead?.companyName || e.lead?.fullName || "Unknown",
    actor: e.user?.name ?? "System",
    eventType: e.eventType,
    createdAt: e.createdAt.toISOString(),
  }));
}

// Sparkline data: daily lead counts for the range
export async function getDailyLeadCounts(range: DateRange | null) {
  const where = buildWhere(range);
  const leads = await prisma.lead.findMany({
    where: { ...where, status: { not: "ARCHIVED" } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const daily: Record<string, number> = {};
  for (const lead of leads) {
    const day = toEstDateString(lead.createdAt);
    daily[day] = (daily[day] || 0) + 1;
  }

  return Object.entries(daily).map(([date, count]) => ({ date, count }));
}

/**
 * Daily series for the Trends widget: new inquiries, abandons, and outcomes.
 * The client aggregates into weekly or monthly buckets.
 */
export async function getTrendSeries(days: number = 180) {
  const start = new Date(Date.now() - days * 86400000);
  const [leads, outcomes] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: { gte: start }, status: { notIn: ["ARCHIVED", "MERGED"] } },
      select: { createdAt: true, fromAbandonedForm: true },
    }),
    prisma.leadOutcome.findMany({
      where: { outcomeDate: { gte: start } },
      select: { outcomeDate: true, outcomeType: true },
    }),
  ]);

  const buckets: Record<string, { date: string; leads: number; abandoned: number; won: number; lost: number; referred: number }> = {};
  const ensure = (d: Date) => {
    const key = toEstDateString(d);
    if (!buckets[key]) buckets[key] = { date: key, leads: 0, abandoned: 0, won: 0, lost: 0, referred: 0 };
    return buckets[key];
  };

  for (const l of leads) {
    const b = ensure(l.createdAt);
    if (l.fromAbandonedForm) b.abandoned++;
    else b.leads++;
  }
  for (const o of outcomes) {
    const b = ensure(o.outcomeDate);
    if (o.outcomeType === "won") b.won++;
    else if (o.outcomeType === "lost") b.lost++;
    else if (o.outcomeType === "referred_out") b.referred++;
  }

  return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
}

/** Abandoned-form funnel: where visitors drop off, and how recapture performs. */
export async function getRecaptureFunnel() {
  const [partialRows, enrollmentGroups, enrollments] = await Promise.all([
    prisma.ingestionQueue.findMany({
      where: { partialStep: { not: null }, OR: [{ leadId: null }, { lead: { status: { not: "ARCHIVED" } } }] },
      select: { partialStep: true },
    }),
    prisma.recaptureEnrollment.groupBy({ by: ["status"], where: { lead: { status: { not: "ARCHIVED" } } }, _count: { id: true } }),
    prisma.recaptureEnrollment.aggregate({ where: { lead: { status: { not: "ARCHIVED" } } }, _sum: { currentStep: true }, _count: { id: true } }),
  ]);

  const stepCounts: Record<string, number> = {};
  for (const r of partialRows) {
    const raw = r.partialStep ?? "unknown";
    const step = raw.replace(/^abandoned_at_/, "");
    stepCounts[step] = (stepCounts[step] || 0) + 1;
  }
  const steps = Object.entries(stepCounts)
    .map(([step, count]) => ({ step, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const byStatus: Record<string, number> = {};
  for (const g of enrollmentGroups) byStatus[g.status] = g._count.id;
  const total = enrollments._count.id;
  const converted = byStatus.converted ?? 0;

  return {
    steps,
    enrollments: {
      total,
      active: byStatus.active ?? 0,
      converted,
      stopped: byStatus.stopped ?? 0,
      exhausted: byStatus.exhausted ?? 0,
      recoveryRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      emailsSent: enrollments._sum.currentStep ?? 0,
    },
  };
}

// Multi-select fields that are stored in rawPayloadJson._rawIntakeForm as arrays
const MULTI_SELECT_FIELDS = new Set([
  "states", "pmSoftware", "listingSites", "rentalTypes", "propertyTypes", "debtTypes",
]);

// Fields stored directly on Lead model as strings
const DIRECT_STRING_FIELDS = new Set([
  "state", "debtType", "industry", "businessType", "urgency", "status", "qualityTier",
]);

// Fields in rawPayloadJson._rawIntakeForm as single values
const INTAKE_SINGLE_FIELDS = new Set([
  "ownershipType", "priorAgency", "debtsNow",
]);

export async function getWinLossStats(range: DateRange | null) {
  const where = range ? { outcomeDate: { gte: range.from, lte: range.to } } : {};
  const results = await prisma.leadOutcome.groupBy({
    by: ["outcomeType"],
    where,
    _count: { id: true },
  });
  return results.map((r) => ({ outcomeType: r.outcomeType, count: r._count.id }));
}

export async function getOutcomeReasonBreakdown(range: DateRange | null, outcomeType: string) {
  const dateWhere = range ? { outcomeDate: { gte: range.from, lte: range.to } } : {};
  const results = await prisma.leadOutcome.groupBy({
    by: ["reason"],
    where: { ...dateWhere, outcomeType },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });
  return results.map((r) => ({ reason: r.reason, count: r._count.id }));
}

export async function getWinRateTrend(range: DateRange | null) {
  const dateWhere = range ? { outcomeDate: { gte: range.from, lte: range.to } } : {};
  const outcomes = await prisma.leadOutcome.findMany({
    where: { ...dateWhere, outcomeType: { in: ["won", "lost"] } },
    select: { outcomeType: true, outcomeDate: true },
    orderBy: { outcomeDate: "asc" },
  });

  const monthly: Record<string, { won: number; lost: number }> = {};
  for (const o of outcomes) {
    const month = `${o.outcomeDate.getFullYear()}-${String(o.outcomeDate.getMonth() + 1).padStart(2, "0")}`;
    if (!monthly[month]) monthly[month] = { won: 0, lost: 0 };
    if (o.outcomeType === "won") monthly[month].won++;
    else monthly[month].lost++;
  }

  return Object.entries(monthly).map(([month, d]) => ({
    month,
    winRate: d.won + d.lost > 0 ? Math.round((d.won / (d.won + d.lost)) * 100) : 0,
  }));
}

export async function getAvgDealValue(range: DateRange | null) {
  const dateWhere = range ? { outcomeDate: { gte: range.from, lte: range.to } } : {};
  const result = await prisma.leadOutcome.aggregate({
    where: { ...dateWhere, outcomeType: "won", estimatedValue: { not: null } },
    _avg: { estimatedValue: true },
    _count: { id: true },
  });
  return {
    avgValue: Number(result._avg.estimatedValue ?? 0),
    count: result._count.id,
  };
}

export async function getCouldHaveWonBreakdown(range: DateRange | null) {
  const dateWhere = range ? { outcomeDate: { gte: range.from, lte: range.to } } : {};
  const results = await prisma.leadOutcome.groupBy({
    by: ["couldHaveWon"],
    where: { ...dateWhere, outcomeType: "lost", couldHaveWon: { not: null } },
    _count: { id: true },
  });
  return results.map((r) => ({ answer: r.couldHaveWon ?? "unknown", count: r._count.id }));
}

export async function getPartnerLeaderboard(range: DateRange | null) {
  const where = range ? {
    outcomeDate: { gte: range.from, lte: range.to },
  } : {};

  const outcomes = await prisma.leadOutcome.findMany({
    where: { ...where, outcomeType: "referred_out", referralPartnerId: { not: null } },
    include: { referralPartner: { select: { id: true, name: true } } },
    orderBy: { outcomeDate: "desc" },
  });

  // Group by partner, compute counts and values
  const partnerMap = new Map<string, { partnerId: string; partnerName: string; referralCount: number; totalValue: number; lastReferralDate: Date | null }>();

  for (const o of outcomes) {
    if (!o.referralPartner) continue;
    const existing = partnerMap.get(o.referralPartner.id) ?? {
      partnerId: o.referralPartner.id,
      partnerName: o.referralPartner.name,
      referralCount: 0,
      totalValue: 0,
      lastReferralDate: null,
    };
    existing.referralCount++;
    existing.totalValue += Number(o.estimatedValue ?? 0);
    if (!existing.lastReferralDate || o.outcomeDate > existing.lastReferralDate) {
      existing.lastReferralDate = o.outcomeDate;
    }
    partnerMap.set(o.referralPartner.id, existing);
  }

  return [...partnerMap.values()]
    .map(p => ({ ...p, avgValue: p.referralCount > 0 ? p.totalValue / p.referralCount : 0, lastReferralDate: p.lastReferralDate?.toISOString() ?? null }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

type RuleSignal = "strong_positive" | "positive" | "neutral" | "negative" | "misleading" | "insufficient_data";

export async function getEnhancedRuleEffectiveness(range: DateRange | null): Promise<Array<{
  name: string; points: number; matched: number; avgImpact: number; pctOfLeads: number;
  winRate: number; baselineWinRate: number; lift: number; sampleSize: number; signal: RuleSignal;
}>> {
  // Get all enabled scoring rules
  const rules = await prisma.scoringRule.findMany({ where: { enabled: true } });

  // Get all leads (with scoreReasons) in range
  const where = buildWhere(range);
  const allLeads = await prisma.lead.findMany({
    where: { ...where, status: { not: "ARCHIVED" } },
    select: { id: true, scoreReasons: true, status: true },
  });

  // Get terminal outcomes
  const outcomeWhere = range ? { outcomeDate: { gte: range.from, lte: range.to } } : {};
  const outcomes = await prisma.leadOutcome.findMany({
    where: outcomeWhere,
    select: { leadId: true, outcomeType: true },
  });
  const outcomeMap = new Map(outcomes.map((o) => [o.leadId, o.outcomeType]));

  // Baseline win rate
  const totalWithOutcome = outcomes.length;
  const totalWon = outcomes.filter((o) => o.outcomeType === "won").length;
  const baselineWinRate = totalWithOutcome > 0 ? (totalWon / totalWithOutcome) * 100 : 0;

  // Per-rule analysis
  const results = [];
  for (const rule of rules) {
    const outcomesJson = rule.outcomesJson as { scoreAdjustment?: number } | null;
    const points = typeof outcomesJson?.scoreAdjustment === "number" ? outcomesJson.scoreAdjustment : 0;

    // Find leads where this rule fired
    const matchedLeads = allLeads.filter((lead) => {
      const sr = lead.scoreReasons as Array<{ ruleName: string; scoreAdjustment: number }> | null;
      return sr?.some((r) => r.ruleName === rule.name);
    });

    const matched = matchedLeads.length;
    const pctOfLeads = allLeads.length > 0 ? (matched / allLeads.length) * 100 : 0;

    // Conversion metrics for matched leads
    const matchedWithOutcome = matchedLeads.filter((l) => outcomeMap.has(l.id));
    const matchedWon = matchedLeads.filter((l) => outcomeMap.get(l.id) === "won");
    const sampleSize = matchedWithOutcome.length;
    const winRate = sampleSize > 0 ? (matchedWon.length / sampleSize) * 100 : 0;
    const lift = baselineWinRate > 0 && sampleSize >= 20 ? winRate / baselineWinRate : 0;

    // Determine signal
    let signal: RuleSignal;
    if (sampleSize < 20) {
      signal = "insufficient_data";
    } else if (points > 0 && lift >= 1.5) {
      signal = "strong_positive";
    } else if (points > 0 && lift >= 1.0) {
      signal = "positive";
    } else if (points > 0 && lift < 1.0) {
      signal = "misleading";
    } else if (points < 0 && winRate < 20) {
      signal = "negative";
    } else {
      signal = "neutral";
    }

    // Avg impact
    const avgImpact =
      matchedLeads.length > 0
        ? matchedLeads.reduce((sum, l) => {
            const sr = l.scoreReasons as Array<{ ruleName: string; scoreAdjustment: number }> | null;
            const match = sr?.find((r) => r.ruleName === rule.name);
            return sum + (match?.scoreAdjustment ?? 0);
          }, 0) / matchedLeads.length
        : 0;

    results.push({
      name: rule.name,
      points,
      matched,
      avgImpact: Math.round(avgImpact * 10) / 10,
      pctOfLeads: Math.round(pctOfLeads),
      winRate,
      baselineWinRate,
      lift,
      sampleSize,
      signal,
    });
  }

  return results.sort((a, b) => b.matched - a.matched);
}

export async function generateScoringInsights(
  stats: Array<{
    name: string;
    points: number;
    winRate: number;
    baselineWinRate: number;
    lift: number;
    signal: string;
  }>
): Promise<string[]> {
  const insights: string[] = [];

  // Sort so misleading comes first, then strong_positive, then negative
  const ordered = [...stats].sort((a, b) => {
    const priority: Record<string, number> = { misleading: 0, strong_positive: 1, negative: 2 };
    return (priority[a.signal] ?? 99) - (priority[b.signal] ?? 99);
  });

  for (const rule of ordered) {
    if (rule.signal === "insufficient_data") continue;
    if (rule.signal === "misleading") {
      insights.push(
        `"${rule.name}" awards +${rule.points} points but leads matching it convert at only ${rule.winRate.toFixed(0)}% (below ${rule.baselineWinRate.toFixed(0)}% baseline). Consider reducing its weight.`
      );
    }
    if (rule.signal === "strong_positive") {
      insights.push(
        `"${rule.name}" has a ${rule.lift.toFixed(1)}x conversion lift (${rule.winRate.toFixed(0)}% win rate). This rule is a strong predictor of success.`
      );
    }
    if (rule.signal === "negative" && rule.points < 0) {
      insights.push(
        `"${rule.name}" (${rule.points} pts) correctly identifies low-conversion leads — only ${rule.winRate.toFixed(0)}% win rate. The penalty appears appropriate.`
      );
    }
  }

  if (insights.length === 0) {
    insights.push(
      "Not enough terminal outcomes to generate meaningful insights yet. Keep processing leads to build the dataset."
    );
  }
  return insights;
}

export async function getCustomChartData(
  field: string,
  range: DateRange | null
): Promise<Array<{ label: string; value: number }>> {
  const where = buildWhere(range);
  const leads = await prisma.lead.findMany({
    where: { ...where, status: { not: "ARCHIVED" } },
    select: {
      state: true,
      states: true,
      debtType: true,
      industry: true,
      businessType: true,
      urgency: true,
      status: true,
      qualityTier: true,
      rawPayloadJson: true,
    },
  });

  const counts: Record<string, number> = {};

  for (const lead of leads) {
    let values: string[] = [];

    if (field === "states") {
      // Use the states JSON array
      const arr = lead.states as string[] | null;
      values = arr && arr.length > 0 ? arr : (lead.state ? [lead.state] : []);
    } else if (MULTI_SELECT_FIELDS.has(field)) {
      // Extract from rawPayloadJson._rawIntakeForm
      const raw = lead.rawPayloadJson as Record<string, unknown> | null;
      const intake = (raw?._rawIntakeForm as Record<string, unknown>) ?? raw;
      const arr = intake?.[field];
      if (Array.isArray(arr)) {
        values = arr.map(String).filter(Boolean);
      } else if (typeof arr === "string" && arr) {
        values = arr.split(",").map((s) => s.trim()).filter(Boolean);
      }
    } else if (DIRECT_STRING_FIELDS.has(field)) {
      const val = (lead as Record<string, unknown>)[field];
      if (val && typeof val === "string") {
        // Some fields like debtType can be comma-separated
        values = val.split(",").map((s) => s.trim()).filter(Boolean);
      }
    } else if (INTAKE_SINGLE_FIELDS.has(field)) {
      const raw = lead.rawPayloadJson as Record<string, unknown> | null;
      const intake = (raw?._rawIntakeForm as Record<string, unknown>) ?? raw;
      const val = intake?.[field];
      if (val && typeof val === "string") values = [val];
    }

    for (const v of values) {
      counts[v] = (counts[v] || 0) + 1;
    }
  }

  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}
