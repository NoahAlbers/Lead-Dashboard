import { Suspense } from "react";
import { getLeads, getLeadStats } from "@/actions/lead.actions";
import { LeadTable } from "@/components/leads/lead-table";
import { LeadFilters } from "@/components/leads/lead-filters";
import { NewLeadIndicator } from "@/components/leads/new-lead-indicator";
import { StatCard } from "@/components/layout/stat-card";
import {
  Inbox,
  PhoneOff,
  Star,
  Clock,
} from "lucide-react";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const filters = {
    search: params.search as string | undefined,
    status: params.status
      ? (params.status as string).split(",")
      : undefined,
    qualityTier: params.qualityTier
      ? (params.qualityTier as string).split(",")
      : undefined,
    state: params.state as string | undefined,
    assignedUserId: params.assignedUserId as string | undefined,
    dateFrom: params.dateFrom as string | undefined,
    dateTo: params.dateTo as string | undefined,
    page: params.page ? Number(params.page) : 1,
    pageSize: params.pageSize ? Number(params.pageSize) : 25,
    sortField: (params.sortField as string) ?? "createdAt",
    sortDirection: (params.sortDirection as "asc" | "desc") ?? "desc",
  };

  const [result, stats] = await Promise.all([
    getLeads(filters),
    getLeadStats(),
  ]);

  const serializedLeads = result.leads.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    lastActivityAt: l.lastActivityAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Lead Inbox</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {result.total} total leads
          </p>
        </div>
        <NewLeadIndicator newCount={stats.newToday} />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="New Today" value={stats.newToday} icon={Inbox} />
        <StatCard label="Uncontacted" value={stats.uncontacted} icon={PhoneOff} />
        <StatCard label="High Quality" value={stats.highQuality} icon={Star} />
        <StatCard
          label="Follow-Up"
          value={stats.followUpNeeded}
          icon={Clock}
        />
      </div>

      {/* Filters */}
      <Suspense fallback={null}>
        <LeadFilters />
      </Suspense>

      {/* Lead Table */}
      <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading leads...</div>}>
        <LeadTable
          leads={serializedLeads as never}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          totalPages={result.totalPages}
          sortField={filters.sortField}
          sortDirection={filters.sortDirection}
        />
      </Suspense>
    </div>
  );
}
