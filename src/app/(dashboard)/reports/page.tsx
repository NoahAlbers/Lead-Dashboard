import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TimeRangeSelector, type TimeRange } from "@/components/shared/time-range-selector";
import { DashboardWidget } from "@/components/reports/dashboard-widget";
import { KPICards } from "@/components/reports/kpi-cards";
import { LeadVolumeChart } from "@/components/reports/lead-volume-chart";
import { QualityDonut } from "@/components/reports/quality-donut";
import { QualityTrend } from "@/components/reports/quality-trend";
import { PipelineFunnel } from "@/components/reports/pipeline-funnel";
import { StatusBreakdown } from "@/components/reports/status-breakdown";
import { GeoHeatmap } from "@/components/reports/geo-heatmap";
import { LeadSources } from "@/components/reports/lead-sources";
import { RuleEffectiveness } from "@/components/reports/rule-effectiveness";
import { AvgScoreChart } from "@/components/reports/avg-score-chart";
import { RecentLeadsTable } from "@/components/reports/recent-leads-table";
import { TopLeads } from "@/components/reports/top-leads";
import { FollowUpTable } from "@/components/reports/follow-up-table";
import { UnitDistribution } from "@/components/reports/unit-distribution";
import { RentDistribution } from "@/components/reports/rent-distribution";
import { ResponseTime } from "@/components/reports/response-time";
import { ActivityFeed } from "@/components/reports/activity-feed";

import {
  getReportKPIs,
  getLeadVolumeByDay,
  getTierDistribution,
  getStatusBreakdown,
  getLeadsByState,
  getLeadSources,
  getPipelineFunnel,
  getAvgScoreOverTime,
  getScoringRuleEffectiveness,
  getRecentLeads,
  getTopLeadsByScore,
  getFollowUpLeads,
  getResponseTime,
  getUnitDistribution,
  getRentDistribution,
  getRecentActivity,
  getDailyLeadCounts,
} from "@/actions/report.actions";

function getRangeDate(range: TimeRange): { from: Date; to: Date } | null {
  const to = new Date();
  switch (range) {
    case "7d":
      return { from: new Date(to.getTime() - 7 * 86400000), to };
    case "30d":
      return { from: new Date(to.getTime() - 30 * 86400000), to };
    case "90d":
      return { from: new Date(to.getTime() - 90 * 86400000), to };
    case "1y":
      return { from: new Date(to.getTime() - 365 * 86400000), to };
    default:
      return null;
  }
}

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
    params.range && ["7d", "30d", "90d", "1y", "all"].includes(params.range)
      ? (params.range as TimeRange)
      : "30d";

  const dateRange = getRangeDate(range);

  // Fetch all widget data in parallel
  const [
    kpis,
    volumeByDay,
    tierDist,
    statusBreakdown,
    byState,
    sources,
    funnel,
    avgScoreTime,
    ruleStats,
    recentLeads,
    topLeads,
    followUps,
    responseTime,
    unitDist,
    rentDist,
    activity,
    sparkline,
  ] = await Promise.all([
    getReportKPIs(dateRange),
    getLeadVolumeByDay(dateRange),
    getTierDistribution(dateRange),
    getStatusBreakdown(dateRange),
    getLeadsByState(dateRange),
    getLeadSources(dateRange),
    getPipelineFunnel(dateRange),
    getAvgScoreOverTime(dateRange),
    getScoringRuleEffectiveness(dateRange),
    getRecentLeads(10),
    getTopLeadsByScore(dateRange, 10),
    getFollowUpLeads(),
    getResponseTime(dateRange),
    getUnitDistribution(dateRange),
    getRentDistribution(dateRange),
    getRecentActivity(20),
    getDailyLeadCounts(dateRange),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Lead performance analytics</p>
        </div>
        <Suspense fallback={null}>
          <TimeRangeSelector />
        </Suspense>
      </div>

      {/* Row 1: KPI Cards */}
      <KPICards data={{ ...kpis, sparkline }} />

      {/* Row 2: Volume + Quality */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardWidget title="Lead Volume Over Time" subtitle="Daily new leads by tier" span={2}>
          <LeadVolumeChart data={volumeByDay} />
        </DashboardWidget>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardWidget title="Quality Distribution" subtitle="Current tier breakdown">
          <QualityDonut data={tierDist} />
        </DashboardWidget>
        <DashboardWidget title="Quality Trend" subtitle="Tier mix over time">
          <QualityTrend data={volumeByDay} />
        </DashboardWidget>
      </div>

      {/* Row 3: Pipeline + Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardWidget title="Pipeline Funnel" subtitle="Lead progression">
          <PipelineFunnel data={funnel} />
        </DashboardWidget>
        <DashboardWidget title="Status Breakdown" subtitle="Leads by current status">
          <StatusBreakdown data={statusBreakdown} />
        </DashboardWidget>
      </div>

      {/* Row 4: Geography + Sources */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardWidget title="Geographic Heatmap" subtitle="Lead density by state">
          <GeoHeatmap data={byState} />
        </DashboardWidget>
        <DashboardWidget title="Lead Sources" subtitle="Where leads come from">
          <LeadSources data={sources} />
        </DashboardWidget>
      </div>

      {/* Row 5: Scoring + Avg Score */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardWidget title="Scoring Rule Effectiveness" subtitle="Which rules are firing">
          <RuleEffectiveness data={ruleStats} />
        </DashboardWidget>
        <DashboardWidget title="Avg Score Over Time" subtitle="Lead quality trend">
          <AvgScoreChart data={avgScoreTime} />
        </DashboardWidget>
      </div>

      {/* Row 6: Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardWidget title="Recent Leads" subtitle="Latest 10 leads" span={2}>
          <RecentLeadsTable leads={recentLeads} />
        </DashboardWidget>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardWidget title="Top Leads by Score" subtitle="Highest scoring leads">
          <TopLeads leads={topLeads} />
        </DashboardWidget>
        <DashboardWidget title="Upcoming Follow-Ups" subtitle="Leads needing attention">
          <FollowUpTable leads={followUps} />
        </DashboardWidget>
      </div>

      {/* Row 7: Distributions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardWidget title="Unit Distribution" subtitle="Portfolio size breakdown">
          <UnitDistribution data={unitDist} />
        </DashboardWidget>
        <DashboardWidget title="Avg Rent Distribution" subtitle="Rent per unit ranges">
          <RentDistribution data={rentDist} />
        </DashboardWidget>
      </div>

      {/* Row 8: Performance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardWidget title="Response Time" subtitle="Time to first contact">
          <ResponseTime data={responseTime} />
        </DashboardWidget>
        <DashboardWidget title="Activity Feed" subtitle="Recent actions across all leads">
          <ActivityFeed activities={activity} />
        </DashboardWidget>
      </div>
    </div>
  );
}
