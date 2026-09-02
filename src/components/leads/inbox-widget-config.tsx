"use client";

import { useState, useEffect } from "react";
import {
  Settings2, X, Inbox, PhoneOff, Star, Clock, Users, TrendingUp, AlertTriangle, CheckCircle,
  XCircle, BarChart3, Target, MapPin, DollarSign, Hash, Flame, Trophy, Activity, Timer,
  UserX, Mail, RotateCcw, Radio,
} from "lucide-react";
import { StatCard } from "@/components/layout/stat-card";
import type { LucideIcon } from "lucide-react";

const STORAGE_KEY = "inbox-widget-config-v2";
const MAX_WIDGETS = 8;

type SeriesKey = "created" | "abandons" | "hot" | "contacted" | "avgScore";

interface MetricDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  /** Sparkline source (daily, last 14 days). */
  spark?: SeriesKey;
  /** Show % change of the last 7 days vs the 7 before, from this series. */
  deltaOf?: SeriesKey;
  hint?: string;
}

const ALL_METRICS: MetricDefinition[] = [
  // Volume
  { id: "new_today", label: "New Today", icon: Inbox, group: "Volume", spark: "created", deltaOf: "created" },
  { id: "new_week", label: "New This Week", icon: Inbox, group: "Volume", spark: "created", deltaOf: "created" },
  { id: "new_month", label: "New This Month", icon: Inbox, group: "Volume" },
  { id: "total", label: "Total Leads", icon: BarChart3, group: "Volume" },
  { id: "live_sessions", label: "In the Form Now", icon: Radio, group: "Volume", hint: "Visitors who touched the intake form in the last hour" },
  // Pipeline
  { id: "uncontacted", label: "Uncontacted", icon: PhoneOff, group: "Pipeline" },
  { id: "unassigned", label: "Unassigned", icon: UserX, group: "Pipeline", hint: "New inquiries nobody owns yet" },
  { id: "unread", label: "Unread", icon: AlertTriangle, group: "Pipeline" },
  { id: "follow_up", label: "Follow-Up Needed", icon: Clock, group: "Pipeline" },
  { id: "followups_due_today", label: "Follow-Ups Due Today", icon: Clock, group: "Pipeline", hint: "Scheduled follow-ups due today" },
  { id: "followups_overdue", label: "Follow-Ups Overdue", icon: AlertTriangle, group: "Pipeline", hint: "Scheduled follow-ups past their time, not yet completed" },
  { id: "contacted", label: "Contacted", icon: CheckCircle, group: "Pipeline", spark: "contacted" },
  { id: "contact_rate_7d", label: "Contact Rate (7d)", icon: Activity, group: "Pipeline", hint: "Share of this week's inquiries that have had a first contact" },
  { id: "avg_response_hrs", label: "Avg Response Time", icon: Timer, group: "Pipeline", hint: "Average time to first contact, last 30 days" },
  { id: "referred", label: "Referred Out", icon: Users, group: "Pipeline" },
  { id: "disqualified", label: "Disqualified", icon: XCircle, group: "Pipeline" },
  { id: "duplicates", label: "Duplicates", icon: AlertTriangle, group: "Pipeline" },
  // Quality
  { id: "hot_week", label: "Hot Leads This Week", icon: Flame, group: "Quality", spark: "hot", deltaOf: "hot", hint: "Top two tiers, this week" },
  { id: "a_leads", label: "A Leads", icon: Star, group: "Quality" },
  { id: "b_leads", label: "B Leads", icon: Star, group: "Quality" },
  { id: "c_leads", label: "C Leads", icon: Star, group: "Quality" },
  { id: "poor_leads", label: "Poor Fit", icon: Target, group: "Quality" },
  { id: "avg_score", label: "Avg Score", icon: TrendingUp, group: "Quality", spark: "avgScore" },
  { id: "top_state_week", label: "Top State (7d)", icon: MapPin, group: "Quality" },
  // Outcomes
  { id: "won_month", label: "Won (30d)", icon: Trophy, group: "Outcomes" },
  { id: "lost_month", label: "Lost (30d)", icon: XCircle, group: "Outcomes" },
  { id: "total_value", label: "Total Balance", icon: DollarSign, group: "Outcomes" },
  { id: "total_units", label: "Total Units", icon: Hash, group: "Outcomes" },
  // Abandoned forms
  { id: "abandons_today", label: "Abandons Today", icon: RotateCcw, group: "Abandoned Forms", spark: "abandons", deltaOf: "abandons" },
  { id: "abandons_week", label: "Abandons This Week", icon: RotateCcw, group: "Abandoned Forms", spark: "abandons", deltaOf: "abandons" },
  { id: "recapture_active", label: "Recapture In Progress", icon: Mail, group: "Abandoned Forms", hint: "Abandoners currently in the email sequence" },
  { id: "recapture_recovered_month", label: "Recovered (30d)", icon: CheckCircle, group: "Abandoned Forms", hint: "Abandoners who came back and finished" },
  // SLA + aging
  { id: "sla_breached", label: "SLA Breached", icon: AlertTriangle, group: "SLA" },
  { id: "sla_at_risk", label: "SLA At Risk", icon: Clock, group: "SLA" },
  { id: "aging_stale", label: "Aging (7d+)", icon: Clock, group: "SLA" },
  // Geography
  { id: "good_states", label: "Good State Leads", icon: MapPin, group: "Geography" },
  { id: "bad_states", label: "Banned State Leads", icon: MapPin, group: "Geography" },
];

const DEFAULT_WIDGETS = ["new_today", "uncontacted", "hot_week", "contact_rate_7d", "abandons_week", "live_sessions"];

function loadWidgetConfig(): string[] {
  if (typeof window === "undefined") return DEFAULT_WIDGETS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGETS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_WIDGETS;
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function saveWidgetConfig(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function getMetricDef(id: string): MetricDefinition | undefined {
  return ALL_METRICS.find((m) => m.id === id);
}

export function getDefaultWidgetIds(): string[] {
  return DEFAULT_WIDGETS;
}

/** % change of the last 7 values vs the 7 before them. */
function weekOverWeek(series: number[] | undefined): number | null {
  if (!series || series.length < 14) return null;
  const recent = series.slice(-7).reduce((a, b) => a + b, 0);
  const prior = series.slice(-14, -7).reduce((a, b) => a + b, 0);
  if (prior === 0) return recent === 0 ? 0 : null;
  return Math.round(((recent - prior) / prior) * 100);
}

interface InboxWidgetsProps {
  metrics: Record<string, number | string>;
  series?: Record<string, number[]>;
  titleRow?: React.ReactNode;
  /** Rendered on the right of the title row, before the Customize button. */
  controls?: React.ReactNode;
}

export function InboxWidgets({ metrics, series = {}, titleRow, controls }: InboxWidgetsProps) {
  const [widgetIds, setWidgetIds] = useState<string[]>(DEFAULT_WIDGETS);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    setWidgetIds(loadWidgetConfig());
  }, []);

  function handleToggle(id: string) {
    setWidgetIds((prev) => {
      let next: string[];
      if (prev.includes(id)) {
        next = prev.filter((x) => x !== id);
      } else if (prev.length >= MAX_WIDGETS) {
        return prev;
      } else {
        next = [...prev, id];
      }
      saveWidgetConfig(next);
      return next;
    });
  }

  function handleReset() {
    setWidgetIds(DEFAULT_WIDGETS);
    saveWidgetConfig(DEFAULT_WIDGETS);
  }

  const groups = Array.from(new Set(ALL_METRICS.map((m) => m.group)));
  const customizeBtn = (
    <button
      onClick={() => setShowConfig(!showConfig)}
      className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      title="Choose which stats show here"
    >
      <Settings2 className="h-3.5 w-3.5" />
      Customize
    </button>
  );

  const cols =
    widgetIds.length <= 4 ? "grid-cols-2 md:grid-cols-4"
    : widgetIds.length <= 6 ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
    : "grid-cols-2 md:grid-cols-4";

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        {titleRow ?? <div />}
        <div className="flex items-center gap-2">
          {controls}
          {customizeBtn}
        </div>
      </div>

      {/* Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfig(false)}>
          <div
            className="bg-card rounded-xl border shadow-lg w-full max-w-lg mx-4 max-h-[75vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Customize Inbox Widgets</h3>
              <button onClick={() => setShowConfig(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Pick up to {MAX_WIDGETS} stats. ({widgetIds.length}/{MAX_WIDGETS} selected). Stats with a trend line show the last 14 days.
              </p>
              {groups.map((group) => (
                <div key={group}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{group}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {ALL_METRICS.filter((m) => m.group === group).map((m) => {
                      const active = widgetIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => handleToggle(m.id)}
                          disabled={!active && widgetIds.length >= MAX_WIDGETS}
                          title={m.hint}
                          className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
                            active
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:border-primary/50 disabled:opacity-40"
                          }`}
                        >
                          <m.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{m.label}</span>
                          {m.spark && <TrendingUp className="h-3 w-3 ml-auto shrink-0 opacity-50" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t">
              <button onClick={handleReset} className="text-sm text-muted-foreground hover:text-foreground">
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Widgets Grid */}
      <div className={`grid gap-4 ${cols}`}>
        {widgetIds.map((id) => {
          const def = getMetricDef(id);
          if (!def) return null;
          const value = metrics[id] ?? 0;
          return (
            <StatCard
              key={id}
              label={def.label}
              value={value}
              icon={def.icon}
              spark={def.spark ? series[def.spark] : undefined}
              delta={def.deltaOf ? weekOverWeek(series[def.deltaOf]) : undefined}
              hint={def.hint}
            />
          );
        })}
      </div>
    </div>
  );
}
