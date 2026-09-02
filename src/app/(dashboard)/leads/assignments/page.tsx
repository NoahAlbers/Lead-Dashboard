import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getWorkloadStats, getUnassignedLeadCount } from "@/actions/assignment.actions";
import { getLeads } from "@/actions/lead.actions";
import { WorkloadPanel } from "@/components/leads/workload-panel";
import { AssignDropdown } from "@/components/leads/assign-dropdown";
import { StatusBadge, TierBadge, ScoreBadge } from "@/components/shared/status-badge";
import { getTierColorMap } from "@/actions/status.actions";
import { SlaBadge } from "@/components/leads/sla-badge";

const PAGE_SIZE = 25;
const OPEN_STATUSES_EXCLUDED = ["ARCHIVED", "MERGED", "WON", "LOST", "DISQUALIFIED", "DUPLICATE", "REFERRED_OUT"] as const;

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    redirect("/leads");
  }

  const [workload, unassignedCount, unassignedResult, tierColorMap] = await Promise.all([
    getWorkloadStats(),
    getUnassignedLeadCount(),
    getLeads({
      assignedUserId: ["__unassigned__"],
      sortField: "slaStatus",
      sortDirection: "desc",
      pageSize: 50,
    }),
    getTierColorMap(),
  ]);

  // Manual filter since Prisma doesn't support "__unassigned__"
  // Actually, let's fetch unassigned leads properly
  const { prisma } = await import("@/lib/db");
  const openWhere = {
    assignedUserId: null,
    status: { notIn: [...OPEN_STATUSES_EXCLUDED] },
    fromAbandonedForm: false,
  };
  const [openCount, unassignedLeads] = await Promise.all([
    prisma.lead.count({ where: openWhere }),
    prisma.lead.findMany({
      where: openWhere,
      include: { assignedUser: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(openCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leads" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Inbox
        </Link>
        <h1 className="text-2xl font-bold">Manage Assignments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {openCount} open inquiries without an owner
          {unassignedCount > openCount && <span className="text-muted-foreground/70"> · {unassignedCount - openCount} more are closed or referred out</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Unassigned Leads */}
        <div className="space-y-4">
          <h2 className="font-semibold">Unassigned Leads</h2>
          <div className="rounded-lg border bg-card overflow-hidden">
            {unassignedLeads.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">All leads are assigned!</p>
            ) : (
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {unassignedLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between p-3 hover:bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <Link href={`/leads/${lead.id}`} className="font-medium text-sm text-primary hover:underline">
                        {lead.companyName || lead.fullName || "Unknown"}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <ScoreBadge score={lead.score} />
                        <TierBadge tier={lead.qualityTier} colorMap={tierColorMap} />
                        <SlaBadge slaStatus={lead.slaStatus} compact />
                        {lead.state && <span className="text-[10px] text-muted-foreground">{lead.state}</span>}
                      </div>
                    </div>
                    <AssignDropdown
                      leadId={lead.id}
                      leadLabel={lead.companyName || lead.fullName || "Lead"}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                {page > 1 && <Link href={`/leads/assignments?page=${page - 1}`} className="rounded-md border px-2.5 py-1 hover:bg-muted">Previous</Link>}
                {page < totalPages && <Link href={`/leads/assignments?page=${page + 1}`} className="rounded-md border px-2.5 py-1 hover:bg-muted">Next</Link>}
              </div>
            </div>
          )}
        </div>

        {/* Right: Staff Workload */}
        <div className="space-y-4">
          <h2 className="font-semibold">Staff Workload</h2>
          <div className="rounded-lg border bg-card p-4">
            <WorkloadPanel stats={workload} tierColorMap={tierColorMap} />
          </div>
        </div>
      </div>
    </div>
  );
}
