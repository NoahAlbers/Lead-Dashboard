import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Inbox,
  Users,
  Star,
  Handshake,
  CheckCircle,
  Download,
  TrendingUp,
  Clock,
} from "lucide-react";
import { StatCard } from "@/components/layout/stat-card";

export default async function ReportsPage() {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/leads");
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalLeads,
    leadsThisMonth,
    leadsThisWeek,
    byStatus,
    byTier,
    referredOut,
    contacted,
    importedToCrm,
    avgScore,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.lead.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.lead.groupBy({
      by: ["status"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.lead.groupBy({
      by: ["qualityTier"],
      _count: { id: true },
      where: { qualityTier: { not: null } },
    }),
    prisma.lead.count({ where: { status: "REFERRED_OUT" } }),
    prisma.lead.count({ where: { status: "CONTACTED" } }),
    prisma.lead.count({ where: { status: "IMPORTED_TO_CRM" } }),
    prisma.lead.aggregate({ _avg: { score: true } }),
  ]);

  const statusLabels: Record<string, string> = {
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
  };

  const tierColors: Record<string, string> = {
    A: "bg-emerald-100 text-emerald-700",
    B: "bg-blue-100 text-blue-700",
    C: "bg-amber-100 text-amber-700",
    POOR: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lead performance overview
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Leads" value={totalLeads} icon={Inbox} />
        <StatCard label="Last 30 Days" value={leadsThisMonth} icon={TrendingUp} />
        <StatCard label="Last 7 Days" value={leadsThisWeek} icon={Clock} />
        <StatCard
          label="Avg Score"
          value={Math.round(avgScore._avg.score ?? 0)}
          icon={Star}
        />
        <StatCard label="Contacted" value={contacted} icon={CheckCircle} />
        <StatCard label="Referred Out" value={referredOut} icon={Handshake} />
        <StatCard label="Imported to CRM" value={importedToCrm} icon={Download} />
        <StatCard
          label="Conversion (Won)"
          value={byStatus.find((s) => s.status === "WON")?._count.id ?? 0}
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Leads by Status */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold mb-4">Leads by Status</h2>
          <div className="space-y-2">
            {byStatus.map((item) => {
              const pct =
                totalLeads > 0
                  ? Math.round((item._count.id / totalLeads) * 100)
                  : 0;
              return (
                <div key={item.status} className="flex items-center gap-3">
                  <span className="w-28 text-sm truncate">
                    {statusLabels[item.status] ?? item.status}
                  </span>
                  <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-sm font-medium">
                    {item._count.id}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leads by Quality Tier */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold mb-4">Leads by Quality Tier</h2>
          <div className="grid grid-cols-2 gap-3">
            {byTier.map((item) => (
              <div
                key={item.qualityTier}
                className={`rounded-lg p-4 ${tierColors[item.qualityTier ?? ""] ?? "bg-muted"}`}
              >
                <p className="text-2xl font-bold">{item._count.id}</p>
                <p className="text-sm font-medium">
                  {item.qualityTier} Lead{item._count.id !== 1 ? "s" : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
