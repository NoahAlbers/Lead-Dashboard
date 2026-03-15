import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  Inbox,
  Star,
  TrendingUp,
  Building2,
  MapPin,
  Activity,
} from "lucide-react";
import { StatCard } from "@/components/layout/stat-card";
import { TimeRangeSelector, type TimeRange } from "@/components/shared/time-range-selector";
import { format, toZonedTime } from "date-fns-tz";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EST_TZ = "America/New_York";

function getRangeDate(range: TimeRange): Date | null {
  const now = new Date();
  switch (range) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMonth(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  REVIEWED: "Reviewed",
  QUALIFIED: "Qualified",
  CONTACTED: "Contacted",
  FOLLOW_UP_NEEDED: "Follow-Up",
  REFERRED_OUT: "Referred",
  IMPORTED_TO_CRM: "In CRM",
  WON: "Won",
  LOST: "Lost",
  DISQUALIFIED: "Disqualified",
  DUPLICATE: "Duplicate",
  ARCHIVED: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-sky-500",
  REVIEWED: "bg-indigo-500",
  QUALIFIED: "bg-emerald-500",
  CONTACTED: "bg-teal-500",
  FOLLOW_UP_NEEDED: "bg-amber-500",
  REFERRED_OUT: "bg-purple-500",
  IMPORTED_TO_CRM: "bg-cyan-500",
  WON: "bg-green-600",
  LOST: "bg-gray-400",
  DISQUALIFIED: "bg-red-500",
  DUPLICATE: "bg-orange-400",
  ARCHIVED: "bg-gray-300",
};

const TIER_COLORS: Record<string, { bar: string; bg: string; text: string }> = {
  A: { bar: "bg-emerald-500", bg: "bg-emerald-500/20", text: "text-emerald-700" },
  B: { bar: "bg-blue-500", bg: "bg-blue-500/20", text: "text-blue-700" },
  C: { bar: "bg-amber-500", bg: "bg-amber-500/20", text: "text-amber-700" },
  POOR: { bar: "bg-red-500", bg: "bg-red-500/20", text: "text-red-700" },
};

const EVENT_LABELS: Record<string, string> = {
  lead_created: "Lead created",
  score_calculated: "Score calculated",
  status_changed: "Status changed",
  note_added: "Note added",
  email_action_opened: "Email action opened",
  call_action_opened: "Call action opened",
  referral_action_opened: "Referral action opened",
  referral_marked_sent: "Referral marked sent",
  crm_exported: "Exported to CRM",
  crm_imported: "Imported to CRM",
  duplicate_flagged: "Duplicate flagged",
  assigned_user_changed: "User assigned",
};

// ---------------------------------------------------------------------------
// Time-bucket helpers
// ---------------------------------------------------------------------------

interface TimeBucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

function buildBuckets(range: TimeRange): TimeBucket[] {
  const now = new Date();
  const buckets: TimeBucket[] = [];

  if (range === "7d" || range === "30d") {
    // Daily buckets
    const days = range === "7d" ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      buckets.push({
        key: start.toISOString().slice(0, 10),
        label: formatDate(start),
        start,
        end,
      });
    }
  } else if (range === "90d") {
    // Daily buckets for 90d too
    for (let i = 89; i >= 0; i--) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      buckets.push({
        key: start.toISOString().slice(0, 10),
        label: formatDate(start),
        start,
        end,
      });
    }
  } else {
    // monthly buckets for all time — go back 12 months max
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      buckets.push({
        key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
        label: formatMonth(start),
        start,
        end,
      });
    }
  }

  return buckets;
}

function bucketize(
  leads: { createdAt: Date; qualityTier: string | null }[],
  buckets: TimeBucket[]
) {
  const counts = buckets.map((b) => ({
    ...b,
    total: 0,
    A: 0,
    B: 0,
    C: 0,
    POOR: 0,
  }));

  for (const lead of leads) {
    const t = lead.createdAt.getTime();
    for (const bucket of counts) {
      if (t >= bucket.start.getTime() && t < bucket.end.getTime()) {
        bucket.total++;
        const tier = lead.qualityTier;
        if (tier && tier in TIER_COLORS) {
          (bucket as unknown as Record<string, number>)[tier]++;
        }
        break;
      }
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/leads");
  }

  const params = await searchParams;
  const range: TimeRange =
    params.range && ["7d", "30d", "90d", "all"].includes(params.range)
      ? (params.range as TimeRange)
      : "30d";

  const rangeDate = getRangeDate(range);
  const dateFilter = rangeDate ? { gte: rangeDate } : undefined;
  const where = dateFilter ? { createdAt: dateFilter } : {};

  // ---- Parallel data fetching ----
  const [
    totalLeads,
    wonLeads,
    avgScore,
    totalUnitsResult,
    leadsForTimeline,
    byStatus,
    byState,
    recentEvents,
  ] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.count({ where: { ...where, status: "WON" } }),
    prisma.lead.aggregate({ where, _avg: { score: true } }),
    // Sum totalUnits from raw payload using accountVolume field
    prisma.lead.findMany({
      where,
      select: { accountVolume: true },
    }),
    prisma.lead.findMany({
      where,
      select: { createdAt: true, qualityTier: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.lead.groupBy({
      by: ["status"],
      where,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.lead.groupBy({
      by: ["state"],
      where: { ...where, state: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.leadEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { name: true } },
        lead: { select: { companyName: true, fullName: true } },
      },
    }),
  ]);

  const conversionRate =
    totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
  const avgScoreValue = Math.round(avgScore._avg.score ?? 0);

  // Sum total units from accountVolume
  const totalUnitsNum = totalUnitsResult.reduce((sum, lead) => {
    const units = parseInt(lead.accountVolume ?? "0", 10);
    return sum + (isNaN(units) ? 0 : units);
  }, 0);

  // ---- Build time series data ----
  const buckets = buildBuckets(range);
  const timeData = bucketize(leadsForTimeline, buckets);
  const maxCount = Math.max(...timeData.map((b) => b.total), 1);
  const maxStacked = Math.max(
    ...timeData.map((b) => b.A + b.B + b.C + b.POOR),
    1
  );

  // ---- Status chart data ----
  const maxStatusCount = Math.max(
    ...byStatus.map((s) => s._count.id),
    1
  );

  // For 30d and 90d, only show every Nth label to avoid overcrowding
  const showEveryNth = range === "90d" ? 7 : range === "30d" ? 3 : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lead performance overview
          </p>
        </div>
        <Suspense fallback={null}>
          <TimeRangeSelector />
        </Suspense>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Leads" value={totalLeads} icon={Inbox} />
        <StatCard label="Avg Score" value={avgScoreValue} icon={Star} />
        <StatCard
          label={`Conversion Rate (${conversionRate}%)`}
          value={wonLeads}
          icon={TrendingUp}
        />
        <StatCard
          label="Est. Units"
          value={totalUnitsNum.toLocaleString()}
          icon={Building2}
        />
      </div>

      {/* Leads Over Time — Bar Chart */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold mb-4">Leads Over Time</h2>
        <div className="flex items-end gap-px h-48">
          {timeData.map((bucket, idx) => {
            const pct = maxCount > 0 ? (bucket.total / maxCount) * 100 : 0;
            return (
              <div
                key={bucket.key}
                className="flex-1 flex flex-col items-center justify-end h-full group relative"
              >
                {/* Tooltip */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {bucket.label}: {bucket.total} lead{bucket.total !== 1 ? "s" : ""}
                </div>
                <div
                  className="w-full rounded-t bg-primary/80 hover:bg-primary transition-colors min-h-[2px]"
                  style={{ height: `${Math.max(pct, 1)}%` }}
                />
                {idx % showEveryNth === 0 ? (
                  <span className="text-[9px] text-muted-foreground mt-1 truncate w-full text-center">
                    {bucket.label.split(" ")[1] ?? bucket.label}
                  </span>
                ) : (
                  <span className="text-[9px] mt-1">&nbsp;</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quality Distribution Over Time — Stacked Bar Chart */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold mb-2">Quality Distribution Over Time</h2>
        <div className="flex items-center gap-4 mb-4">
          {(["A", "B", "C", "POOR"] as const).map((tier) => (
            <div key={tier} className="flex items-center gap-1.5 text-xs">
              <div className={`w-3 h-3 rounded-sm ${TIER_COLORS[tier].bar}`} />
              <span className="text-muted-foreground">
                {tier === "POOR" ? "Poor" : `${tier} Lead`}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-px h-48">
          {timeData.map((bucket, idx) => {
            const bucketTotal = bucket.A + bucket.B + bucket.C + bucket.POOR;
            const pct =
              maxStacked > 0 ? (bucketTotal / maxStacked) * 100 : 0;
            const segHeight = (count: number) =>
              bucketTotal > 0
                ? `${(count / bucketTotal) * Math.max(pct, 1)}%`
                : "0%";
            return (
              <div
                key={bucket.key}
                className="flex-1 flex flex-col items-center justify-end h-full group relative"
              >
                {/* Tooltip */}
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  A:{bucket.A} B:{bucket.B} C:{bucket.C} Poor:{bucket.POOR}
                </div>
                <div
                  className="w-full flex flex-col-reverse rounded-t overflow-hidden"
                  style={{ height: `${Math.max(pct, 1)}%` }}
                >
                  <div
                    className={TIER_COLORS.POOR.bar}
                    style={{ height: segHeight(bucket.POOR) }}
                  />
                  <div
                    className={TIER_COLORS.C.bar}
                    style={{ height: segHeight(bucket.C) }}
                  />
                  <div
                    className={TIER_COLORS.B.bar}
                    style={{ height: segHeight(bucket.B) }}
                  />
                  <div
                    className={TIER_COLORS.A.bar}
                    style={{ height: segHeight(bucket.A) }}
                  />
                </div>
                {idx % showEveryNth === 0 ? (
                  <span className="text-[9px] text-muted-foreground mt-1 truncate w-full text-center">
                    {bucket.label.split(" ")[1] ?? bucket.label}
                  </span>
                ) : (
                  <span className="text-[9px] mt-1">&nbsp;</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Status Breakdown — Horizontal Bar Chart */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold mb-4">Status Breakdown</h2>
          <div className="space-y-2.5">
            {byStatus.map((item) => {
              const pct =
                maxStatusCount > 0
                  ? (item._count.id / maxStatusCount) * 100
                  : 0;
              const color =
                STATUS_COLORS[item.status] ?? "bg-gray-400";
              return (
                <div key={item.status} className="flex items-center gap-3">
                  <span className="w-24 text-sm truncate text-muted-foreground">
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                  <div className="flex-1 h-6 rounded bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded ${color} transition-all`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-semibold tabular-nums">
                    {item._count.id}
                  </span>
                </div>
              );
            })}
            {byStatus.length === 0 && (
              <p className="text-sm text-muted-foreground">No leads in this range.</p>
            )}
          </div>
        </div>

        {/* Top States */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Top States
          </h2>
          <div className="space-y-2">
            {byState.map((item, idx) => {
              const maxStateCount = byState[0]?._count.id ?? 1;
              const pct = (item._count.id / maxStateCount) * 100;
              return (
                <div key={item.state} className="flex items-center gap-3">
                  <span className="w-6 text-xs text-muted-foreground text-right tabular-nums">
                    {idx + 1}.
                  </span>
                  <span className="w-10 text-sm font-medium">
                    {item.state ?? "N/A"}
                  </span>
                  <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full rounded bg-primary/60"
                      style={{ width: `${Math.max(pct, 3)}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-semibold tabular-nums">
                    {item._count.id}
                  </span>
                </div>
              );
            })}
            {byState.length === 0 && (
              <p className="text-sm text-muted-foreground">No state data available.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Recent Activity
        </h2>
        <div className="space-y-3">
          {recentEvents.map((event) => {
            const leadLabel =
              event.lead?.companyName || event.lead?.fullName || "Unknown lead";
            const actor = event.user?.name ?? "System";
            const eventLabel =
              EVENT_LABELS[event.eventType] ?? event.eventType;
            const estTime = toZonedTime(event.createdAt, EST_TZ);
            return (
              <div
                key={event.id}
                className="flex items-start gap-3 text-sm"
              >
                <div className="flex-shrink-0 mt-1 w-2 h-2 rounded-full bg-primary/60" />
                <div className="flex-1 min-w-0">
                  <p>
                    <span className="font-medium">{actor}</span>
                    {" — "}
                    {eventLabel}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {leadLabel}
                  </p>
                </div>
                <time className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {format(estTime, "MMM d, h:mm a", { timeZone: EST_TZ })} EST
                </time>
              </div>
            );
          })}
          {recentEvents.length === 0 && (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          )}
        </div>
      </div>
    </div>
  );
}
