import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TimeRangeSelector, type TimeRange } from "@/components/shared/time-range-selector";
import { estStartOfDay } from "@/lib/timezone";
import { DashboardWidget } from "@/components/reports/dashboard-widget";
import { DashboardGrid } from "@/components/reports/dashboard-grid";
import { KPICards } from "@/components/reports/kpi-cards";
import { LeadVolumeChart } from "@/components/reports/lead-volume-chart";
import { QualityDonut } from "@/components/reports/quality-donut";
import { QualityTrend } from "@/components/reports/quality-trend";
import { PipelineFunnel } from "@/components/reports/pipeline-funnel";
import { StatusBreakdown } from "@/components/reports/status-breakdown";
import { GeoHeatmap } from "@/components/reports/geo-heatmap";
import { ScoringInsights } from "@/components/reports/scoring-insights";
import { AvgScoreChart } from "@/components/reports/avg-score-chart";
import { TrendsWidget } from "@/components/reports/trends-widget";
import { RecaptureFunnel } from "@/components/reports/recapture-funnel";
import { RecentLeadsTable } from "@/components/reports/recent-leads-table";
import { TopLeads } from "@/components/reports/top-leads";
import { FollowUpTable } from "@/components/reports/follow-up-table";
import { UnitDistribution } from "@/components/reports/unit-distribution";
import { RentDistribution } from "@/components/reports/rent-distribution";
import { ResponseTime } from "@/components/reports/response-time";
import { ActivityFeed } from "@/components/reports/activity-feed";
import { CustomChartManager } from "@/components/reports/custom-chart-builder";
import { getStateClassificationMap } from "@/actions/state-classification.actions";
import { getTierColorMap } from "@/actions/status.actions";
import { AutoRefreshBar } from "@/components/shared/auto-refresh-bar";
import { ActivityExportButton } from "@/components/reports/activity-export-button";
import { WinLossRatio, LossReasons, WinRateTrend, CouldHaveWon } from "@/components/reports/win-loss-widgets";
import { PartnerLeaderboard } from "@/components/reports/partner-leaderboard";

import {
  getReportKPIs,
  getLeadVolumeByDay,
  getTierDistribution,
  getStatusBreakdown,
  getLeadsByState,
  getPipelineFunnel,
  getAvgScoreOverTime,
  getEnhancedRuleEffectiveness,
  generateScoringInsights,
  getRecentLeads,
  getTopLeadsByScore,
  getFollowUpLeads,
  getResponseTime,
  getUnitDistribution,
  getRentDistribution,
  getRecentActivity,
  getDailyLeadCounts,
  getWinLossStats,
  getOutcomeReasonBreakdown,
  getWinRateTrend as getWinRateTrendData,
  getCouldHaveWonBreakdown,
  getPartnerLeaderboard,
  getTrendSeries,
  getRecaptureFunnel,
} from "@/actions/report.actions";

function getRangeDate(range: TimeRange): { from: Date; to: Date } | null {
  const to = new Date();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : range === "1y" ? 365 : 0;
  if (days === 0) return null;
  const from = estStartOfDay(new Date(to.getTime() - days * 86400000));
  return { from, to };
}

// Widget layout: w=1 is half-width, w=2 is full-width
const DEFAULT_LAYOUT = [
  { i: "kpi", w: 2 },
  { i: "volume", w: 2 },
  { i: "quality-donut", w: 1 },
  { i: "quality-trend", w: 1 },
  { i: "funnel", w: 1 },
  { i: "status", w: 1 },
  { i: "geo", w: 1 },
  { i: "rules", w: 1 },
  { i: "avg-score", w: 1 },
  { i: "trends", w: 2 },
  { i: "recapture", w: 1 },
  { i: "recent", w: 2 },
  { i: "top-leads", w: 1 },
  { i: "follow-ups", w: 1 },
  { i: "units", w: 1 },
  { i: "rent", w: 1 },
  { i: "response", w: 1 },
  { i: "activity", w: 1 },
  { i: "win-loss", w: 1 },
  { i: "loss-reasons", w: 1 },
  { i: "win-rate-trend", w: 1 },
  { i: "could-have-won", w: 1 },
  { i: "partner-leaderboard", w: 2 },
];

const WIDGET_KEYS = DEFAULT_LAYOUT.map((l) => l.i);

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

  const [
    kpis, volumeByDay, tierDist, statusBreakdown, byState,
    funnel, avgScoreTime, ruleStats, recentLeads, topLeads, followUps,
    responseTime, unitDist, rentDist, activity, sparkline, stateClassifications,
    tierColorMap, winLossStats, lossReasons, winRateTrend, couldHaveWon,
    partnerLeaderboard, trendSeries, recaptureFunnel,
  ] = await Promise.all([
    getReportKPIs(dateRange),
    getLeadVolumeByDay(dateRange),
    getTierDistribution(dateRange),
    getStatusBreakdown(dateRange),
    getLeadsByState(dateRange),
    getPipelineFunnel(dateRange),
    getAvgScoreOverTime(dateRange),
    getEnhancedRuleEffectiveness(dateRange),
    getRecentLeads(10),
    getTopLeadsByScore(dateRange, 10),
    getFollowUpLeads(),
    getResponseTime(dateRange),
    getUnitDistribution(dateRange),
    getRentDistribution(dateRange),
    getRecentActivity(20),
    getDailyLeadCounts(dateRange),
    getStateClassificationMap(),
    getTierColorMap(),
    getWinLossStats(dateRange),
    getOutcomeReasonBreakdown(dateRange, "lost"),
    getWinRateTrendData(dateRange),
    getCouldHaveWonBreakdown(dateRange),
    getPartnerLeaderboard(dateRange),
    getTrendSeries(180),
    getRecaptureFunnel(),
  ]);

  const ruleInsights = await generateScoringInsights(ruleStats);

  // Serialize dateRange for client component
  const dateRangeJson = dateRange ? { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() } : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Lead performance analytics</p>
        </div>
        <div className="flex items-center gap-4">
          <ActivityExportButton userRole={session.user.role} />
          <AutoRefreshBar variant="reports" />
          <Suspense fallback={null}>
            <TimeRangeSelector />
          </Suspense>
        </div>
      </div>

      {/* Dashboard Grid */}
      <DashboardGrid widgetKeys={WIDGET_KEYS} defaultLayout={DEFAULT_LAYOUT}>
        {/* KPI Cards */}
        <div><KPICards data={{ ...kpis, sparkline }} /></div>

        {/* Volume */}
        <DashboardWidget title="Lead Volume Over Time" subtitle="Daily new leads by tier">
          <LeadVolumeChart data={volumeByDay} tierColorMap={tierColorMap} />
        </DashboardWidget>

        {/* Quality */}
        <DashboardWidget title="Quality Distribution" subtitle="Current tier breakdown">
          <QualityDonut data={tierDist} tierColorMap={tierColorMap} />
        </DashboardWidget>
        <DashboardWidget title="Quality Trend" subtitle="Tier mix over time">
          <QualityTrend data={volumeByDay} tierColorMap={tierColorMap} />
        </DashboardWidget>

        {/* Pipeline */}
        <DashboardWidget title="Pipeline Funnel" subtitle="Lead progression">
          <PipelineFunnel data={funnel} />
        </DashboardWidget>
        <DashboardWidget title="Status Breakdown" subtitle="Leads by current status">
          <StatusBreakdown data={statusBreakdown} />
        </DashboardWidget>

        {/* Geography */}
        <DashboardWidget title="Geographic Heatmap" subtitle="Lead density by state">
          <GeoHeatmap data={byState} stateClassifications={stateClassifications} />
        </DashboardWidget>
        {/* Scoring */}
        <DashboardWidget title="Rule Effectiveness" subtitle="Conversion lift & signal analysis">
          <ScoringInsights data={ruleStats} insights={ruleInsights} />
        </DashboardWidget>
        <DashboardWidget title="Avg Score Over Time" subtitle="Lead quality trend">
          <AvgScoreChart data={avgScoreTime} />
        </DashboardWidget>

        <DashboardWidget title="Trends Over Time" subtitle="Weekly and monthly patterns (last 180 days)">
          <TrendsWidget data={trendSeries} />
        </DashboardWidget>

        <DashboardWidget title="Abandoned Form Recapture" subtitle="Drop-off points and win-back results">
          <RecaptureFunnel data={recaptureFunnel} />
        </DashboardWidget>

        {/* Tables */}
        <DashboardWidget title="Recent Leads" subtitle="Latest 10 leads">
          <RecentLeadsTable leads={recentLeads} tierColorMap={tierColorMap} />
        </DashboardWidget>
        <DashboardWidget title="Top Leads by Score" subtitle="Highest scoring leads">
          <TopLeads leads={topLeads} tierColorMap={tierColorMap} />
        </DashboardWidget>
        <DashboardWidget title="Upcoming Follow-Ups" subtitle="Leads needing attention">
          <FollowUpTable leads={followUps} />
        </DashboardWidget>

        {/* Distributions */}
        <DashboardWidget title="Unit Distribution" subtitle="Portfolio size breakdown">
          <UnitDistribution data={unitDist} />
        </DashboardWidget>
        <DashboardWidget title="Avg Rent Distribution" subtitle="Rent per unit ranges">
          <RentDistribution data={rentDist} />
        </DashboardWidget>

        {/* Performance */}
        <DashboardWidget title="Response Time" subtitle="Time to first contact">
          <ResponseTime data={responseTime} />
        </DashboardWidget>
        <DashboardWidget title="Activity Feed" subtitle="Recent actions">
          <ActivityFeed activities={activity} />
        </DashboardWidget>

        {/* Win/Loss Analysis */}
        <DashboardWidget title="Win/Loss Ratio" subtitle="Outcome distribution">
          <WinLossRatio data={winLossStats} />
        </DashboardWidget>
        <DashboardWidget title="Loss Reasons" subtitle="Top reasons for lost deals">
          <LossReasons data={lossReasons} />
        </DashboardWidget>
        <DashboardWidget title="Win Rate Trend" subtitle="Monthly win rate">
          <WinRateTrend data={winRateTrend} />
        </DashboardWidget>
        <DashboardWidget title="Could Have Won?" subtitle="Lost deal analysis">
          <CouldHaveWon data={couldHaveWon} />
        </DashboardWidget>

        {/* Partner Leaderboard */}
        <DashboardWidget title="Referral Partner Leaderboard" subtitle="Partners ranked by referral value">
          <PartnerLeaderboard data={partnerLeaderboard} />
        </DashboardWidget>

      </DashboardGrid>

      {/* Custom Charts — outside grid for proper sizing */}
      <CustomChartManager dateRange={dateRangeJson ? { from: new Date(dateRangeJson.from), to: new Date(dateRangeJson.to) } : null} />
    </div>
  );
}
