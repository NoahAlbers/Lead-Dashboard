import { Suspense } from "react";
import { getLeads, getLeadStats, getWidgetMetrics } from "@/actions/lead.actions";
import { getStateClassificationMap } from "@/actions/state-classification.actions";
import { getTierColorMap } from "@/actions/status.actions";
import { getActivePartners } from "@/actions/partner.actions";
import { prisma } from "@/lib/db";
import { LeadTable } from "@/components/leads/lead-table";
import { LeadFilters } from "@/components/leads/lead-filters";
import { InboxWidgets } from "@/components/leads/inbox-widget-config";
import { StartWorkingButton } from "@/components/leads/start-working-button";

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
    slaStatus: params.slaStatus
      ? (params.slaStatus as string).split(",")
      : undefined,
    dateFrom: params.dateFrom as string | undefined,
    dateTo: params.dateTo as string | undefined,
    isRead: params.isRead as string | undefined,
    page: params.page ? Number(params.page) : 1,
    pageSize: params.pageSize ? Number(params.pageSize) : 25,
    sortField: (params.sortField as string) ?? "createdAt",
    sortDirection: (params.sortDirection as "asc" | "desc") ?? "desc",
  };

  // Fetch all possible widget metrics so client can pick from them
  const allMetricIds = [
    "new_today", "new_week", "new_month", "total", "uncontacted", "unread",
    "a_leads", "b_leads", "c_leads", "poor_leads", "follow_up", "referred",
    "contacted", "disqualified", "duplicates", "avg_score", "good_states",
    "bad_states", "total_value", "total_units", "sla_breached", "sla_at_risk",
  ];

  const [result, stats, emailTemplates, stateClassifications, widgetMetrics, tierColorMap, activePartners] = await Promise.all([
    getLeads(filters),
    getLeadStats(),
    prisma.emailTemplate.findMany({
      where: { active: true },
      orderBy: { type: "asc" },
      include: { emailType: { select: { color: true, isReferral: true } } },
    }),
    getStateClassificationMap(),
    getWidgetMetrics(allMetricIds),
    getTierColorMap(),
    getActivePartners(),
  ]);

  const serializedLeads = result.leads.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    lastActivityAt: l.lastActivityAt?.toISOString() ?? null,
  }));

  const serializedTemplates = emailTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.type,
    subjectTemplate: t.subjectTemplate,
    bodyTemplate: t.bodyTemplate,
    emailType: t.emailType ? { color: t.emailType.color, isReferral: t.emailType.isReferral } : null,
  }));

  return (
    <div className="space-y-6">
      {/* Title + Quick Stats — configurable */}
      <InboxWidgets
        metrics={widgetMetrics}
        titleRow={
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">Lead Inbox</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {result.total} total leads
              </p>
            </div>
            <StartWorkingButton />
          </div>
        }
      />

      {/* Lead Table with integrated filters */}
      <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading leads...</div>}>
        <LeadTable
          filterBar={<LeadFilters />}
          leads={serializedLeads as never}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          totalPages={result.totalPages}
          sortField={filters.sortField}
          sortDirection={filters.sortDirection}
          emailTemplates={serializedTemplates}
          stateClassifications={stateClassifications}
          tierColorMap={tierColorMap}
          referralPartners={activePartners}
        />
      </Suspense>
    </div>
  );
}
