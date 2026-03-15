"use client";

import { useState, useEffect } from "react";
import { Settings2, X, Inbox, PhoneOff, Star, Clock, Users, TrendingUp, AlertTriangle, CheckCircle, XCircle, BarChart3, Target, MapPin, DollarSign, Hash } from "lucide-react";
import { StatCard } from "@/components/layout/stat-card";
import type { LucideIcon } from "lucide-react";

const STORAGE_KEY = "inbox-widget-config";

interface MetricDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
}

const ALL_METRICS: MetricDefinition[] = [
  // Volume
  { id: "new_today", label: "New Today", icon: Inbox, group: "Volume" },
  { id: "new_week", label: "New This Week", icon: Inbox, group: "Volume" },
  { id: "new_month", label: "New This Month", icon: Inbox, group: "Volume" },
  { id: "total", label: "Total Leads", icon: BarChart3, group: "Volume" },
  // Status
  { id: "uncontacted", label: "Uncontacted", icon: PhoneOff, group: "Status" },
  { id: "unread", label: "Unread", icon: AlertTriangle, group: "Status" },
  { id: "follow_up", label: "Follow-Up Needed", icon: Clock, group: "Status" },
  { id: "contacted", label: "Contacted", icon: CheckCircle, group: "Status" },
  { id: "referred", label: "Referred Out", icon: Users, group: "Status" },
  { id: "disqualified", label: "Disqualified", icon: XCircle, group: "Status" },
  { id: "duplicates", label: "Duplicates", icon: AlertTriangle, group: "Status" },
  // Quality
  { id: "a_leads", label: "A Leads", icon: Star, group: "Quality" },
  { id: "b_leads", label: "B Leads", icon: Star, group: "Quality" },
  { id: "c_leads", label: "C Leads", icon: Star, group: "Quality" },
  { id: "poor_leads", label: "Poor Fit", icon: Target, group: "Quality" },
  { id: "avg_score", label: "Avg Score", icon: TrendingUp, group: "Quality" },
  // Other
  { id: "good_states", label: "Good State Leads", icon: MapPin, group: "Other" },
  { id: "bad_states", label: "Banned State Leads", icon: MapPin, group: "Other" },
  { id: "total_value", label: "Total Balance", icon: DollarSign, group: "Other" },
  { id: "total_units", label: "Total Units", icon: Hash, group: "Other" },
  // SLA
  { id: "sla_breached", label: "SLA Breached", icon: AlertTriangle, group: "SLA" },
  { id: "sla_at_risk", label: "SLA At Risk", icon: Clock, group: "SLA" },
];

const DEFAULT_WIDGETS = ["new_today", "uncontacted", "a_leads", "follow_up"];

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

interface InboxWidgetsProps {
  metrics: Record<string, number | string>;
  titleRow?: React.ReactNode;
}

export function InboxWidgets({ metrics, titleRow }: InboxWidgetsProps) {
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
      } else if (prev.length >= 6) {
        return prev; // Max 6
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

  return (
    <div>
      {titleRow ? (
        <div className="flex items-center justify-between mb-4">
          {titleRow}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Customize
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-end mb-4">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Customize
          </button>
        </div>
      )}

      {/* Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfig(false)}>
          <div
            className="bg-card rounded-xl border shadow-lg w-full max-w-md mx-4 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Customize Stat Widgets</h3>
              <button onClick={() => setShowConfig(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Select up to 6 metrics to display. ({widgetIds.length}/6 selected)
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
                          disabled={!active && widgetIds.length >= 6}
                          className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors ${
                            active
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:border-primary/50 disabled:opacity-40"
                          }`}
                        >
                          <m.icon className="h-3.5 w-3.5 shrink-0" />
                          {m.label}
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
      <div className={`grid gap-4 ${widgetIds.length <= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"}`}>
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
            />
          );
        })}
      </div>
    </div>
  );
}
