import { Suspense } from "react";
import { getLeads, getLeadStats, getWidgetMetrics, getAbandonedLeadCount } from "@/actions/lead.actions";
import Link from "next/link";
import { getSystemConfig } from "@/actions/config.actions";
import { getStateClassificationMap } from "@/actions/state-classification.actions";
import { getTierColorMap } from "@/actions/status.actions";
import { getActivePartners } from "@/actions/partner.actions";
import { getSavedViews } from "@/actions/saved-view.actions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LeadTable } from "@/components/leads/lead-table";
import { LeadFilters } from "@/components/leads/lead-filters";
import { PinnedViewsBar } from "@/components/leads/pinned-views-bar";
import { InboxWidgets } from "@/components/leads/inbox-widget-config";
import { StartWorkingButton } from "@/components/leads/start-working-button";
import { AutoRefreshBar } from "@/components/shared/auto-refresh-bar";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const numParam = (v: string | string[] | undefined) =>
    v != null && v !== "" ? Number(v) : undefined;

  const filters = {
    search: params.search as string | undefined,
    status: params.status
      ? (params.status as string).split(",")
      : undefined,
    qualityTier: params.qualityTier
      ? (params.qualityTier as string).split(",")
      : undefined,
    state: params.state as string | undefined,
    states: params.states ? (params.states as string).split(",") : undefined,
    statesOp: params.statesOp as string | undefined,
    stateClass: params.stateClass as string | undefined,
    assignedUserId: params.assignedUserId
      ? (params.assignedUserId as string).split(",")
      : undefined,
    slaStatus: params.slaStatus
      ? (params.slaStatus as string).split(",")
      : undefined,
    unitsMin: numParam(params.unitsMin),
    unitsMax: numParam(params.unitsMax),
    scoreMin: numParam(params.scoreMin),
    scoreMax: numParam(params.scoreMax),
    rentMin: numParam(params.rentMin),
    rentMax: numParam(params.rentMax),
    industry: params.industry as string | undefined,
    debtType: params.debtType as string | undefined,
    businessType: params.businessType as string | undefined,
    software: params.software as string | undefined,
    view: params.view as string | undefined,
    dateFrom: params.dateFrom as string | undefined,
    dateTo: params.dateTo as string | undefined,
    isRead: params.isRead as string | undefined,
    ageMin: params.ageMin ? Number(params.ageMin) : undefined,
    page: params.page ? Number(params.page) : 1,
    pageSize: params.pageSize ? Math.min(Math.max(Number(params.pageSize) || 25, 1), 200) : 25,
    sortField: (params.sortField as string) ?? "createdAt",
    sortDirection: (params.sortDirection as "asc" | "desc") ?? "desc",
  };

  // Fetch all possible widget metrics so client can pick from them
  const allMetricIds = [
    "new_today", "new_week", "new_month", "total", "uncontacted", "unread",
    "a_leads", "b_leads", "c_leads", "poor_leads", "follow_up", "referred",
    "contacted", "disqualified", "duplicates", "avg_score", "good_states",
    "bad_states", "total_value", "total_units", "sla_breached", "sla_at_risk",
    "aging_stale",
  ];

  const session = await auth();

  const [result, stats, emailTemplates, stateClassifications, widgetMetrics, tierColorMap, activePartners, agingThresholds, savedViews] = await Promise.all([
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
    getSystemConfig("aging_thresholds"),
    getSavedViews(),
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

  const mappedViews = savedViews.map((v) => ({
    id: v.id,
    name: v.name,
    filtersJson: v.filtersJson as Record<string, string> | null,
    sortJson: v.sortJson as Record<string, string> | null,
    isTeamView: v.isTeamView,
    isSystem: v.isSystem,
    isPinned: v.isPinned,
    userId: v.userId,
  }));

  // Real tier names (e.g. "A Lead") for the multi-select — the lead's
  // qualityTier stores the tier NAME, so the filter must use it too.
  const tierOptions = Object.keys(tierColorMap).map((name) => ({
    value: name,
    label: name,
  }));

  // Inquiries / Abandoned tabs — keep filters, drop page + view
  const abandonedCount = await getAbandonedLeadCount();
  const currentView = (params.view as string) === "abandoned" ? "abandoned" : "inquiries";
  const tabQs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "view" || k === "page" || v == null) continue;
    tabQs.set(k, Array.isArray(v) ? v[0] : v);
  }
  const baseQs = tabQs.toString();
  const inquiriesHref = `/leads${baseQs ? `?${baseQs}` : ""}`;
  tabQs.set("view", "abandoned");
  const abandonedHref = `/leads?${tabQs.toString()}`;
  const tabCls = (active: boolean) =>
    `inline-flex items-center gap-2 border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
      active
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="space-y-6">
      <AutoRefreshBar variant="inbox" />

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

      {/* Pinned saved views */}
      {session?.user?.id && (
        <PinnedViewsBar
          views={mappedViews}
          currentUserId={session.user.id}
          userRole={session.user.role}
        />
      )}

      {/* Inquiries / Abandoned tabs */}
      <div className="flex items-center gap-6 border-b">
        <Link href={inquiriesHref} className={tabCls(currentView === "inquiries")}>
          Inquiries
        </Link>
        <Link href={abandonedHref} className={tabCls(currentView === "abandoned")}>
          Abandoned
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            {abandonedCount}
          </span>
        </Link>
      </div>

      {/* Lead Table with integrated filters */}
      <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading leads...</div>}>
        <LeadTable
          filterBar={
            <LeadFilters
              savedViews={mappedViews}
              currentUserId={session?.user?.id}
              userRole={session?.user?.role}
              stateClassifications={stateClassifications}
              tierOptions={tierOptions}
            />
          }
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
          agingThresholds={agingThresholds as any}
          userRole={session?.user?.role}
        />
      </Suspense>
    </div>
  );
}
