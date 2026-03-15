"use server";

import { prisma } from "@/lib/db";
import { normalizeState } from "@/lib/us-states";

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
    prisma.lead.aggregate({ where, _avg: { score: true } }),
    prisma.lead.aggregate({ where: prevWhere, _avg: { score: true } }),
    prisma.lead.count({ where: { ...where, status: { in: ["CONTACTED", "QUALIFIED", "WON"] } } }),
    prisma.lead.count({ where: { ...prevWhere, status: { in: ["CONTACTED", "QUALIFIED", "WON"] } } }),
    prisma.lead.findMany({ where, select: { accountVolume: true } }),
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
  for (const lead of leads) {
    const day = lead.createdAt.toISOString().slice(0, 10);
    if (!buckets[day]) buckets[day] = { date: day, total: 0 };
    buckets[day].total++;
    const tier = lead.qualityTier ?? "Unknown";
    buckets[day][tier] = ((buckets[day][tier] as number) || 0) + 1;
  }

  return Object.values(buckets);
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
    where,
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });
  return results.map((r) => ({ status: r.status, count: r._count.id }));
}

export async function getLeadsByState(range: DateRange | null) {
  const where = buildWhere(range);
  const leads = await prisma.lead.findMany({
    where: { ...where, state: { not: null }, status: { not: "ARCHIVED" } },
    select: { state: true, accountVolume: true },
  });

  const map: Record<string, { count: number; units: number }> = {};
  for (const lead of leads) {
    const state = normalizeState(lead.state) || lead.state || "Unknown";
    if (!map[state]) map[state] = { count: 0, units: 0 };
    map[state].count++;
    map[state].units += parseInt(lead.accountVolume ?? "0", 10) || 0;
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
    const day = lead.createdAt.toISOString().slice(0, 10);
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
      lead: where,
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
    const day = lead.createdAt.toISOString().slice(0, 10);
    daily[day] = (daily[day] || 0) + 1;
  }

  return Object.entries(daily).map(([date, count]) => ({ date, count }));
}
