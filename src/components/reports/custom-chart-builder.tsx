"use client";

import { useState, useTransition, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { getCustomChartData } from "@/actions/report.actions";
import { CustomChart } from "./custom-chart";

interface ChartConfig {
  id: string;
  field: string;
  chartType: "bar" | "pie" | "line";
  title: string;
}

interface ChartData {
  label: string;
  value: number;
}

const AVAILABLE_FIELDS = [
  { value: "state", label: "State (primary)" },
  { value: "states", label: "States (all selected)" },
  { value: "debtType", label: "Debt Type" },
  { value: "industry", label: "Industry / Property Types" },
  { value: "businessType", label: "Business Type / Rental Types" },
  { value: "urgency", label: "Urgency" },
  { value: "status", label: "Lead Status" },
  { value: "qualityTier", label: "Quality Tier" },
  { value: "pmSoftware", label: "PM Software" },
  { value: "listingSites", label: "Listing Sites" },
  { value: "rentalTypes", label: "Rental Types" },
  { value: "propertyTypes", label: "Property Types" },
  { value: "ownershipType", label: "Ownership Type" },
  { value: "priorAgency", label: "Prior Agency Experience" },
  { value: "debtsNow", label: "Debts Ready Now" },
];

const CHART_TYPES = [
  { value: "bar", label: "Bar Chart" },
  { value: "pie", label: "Pie Chart" },
  { value: "line", label: "Trend Line" },
] as const;

const STORAGE_KEY = "custom-charts";

function loadCharts(): ChartConfig[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch { return []; }
}

function saveCharts(charts: ChartConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
}

function CustomChartCard({ config, onRemove, dateRange }: { config: ChartConfig; onRemove: () => void; dateRange: { from: Date; to: Date } | null }) {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCustomChartData(config.field, dateRange).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [config.field, dateRange]);

  return (
    <div className="rounded-lg border bg-card h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3">
        <h3 className="font-semibold text-sm">{config.title}</h3>
        <button onClick={onRemove} className="rounded p-1 hover:bg-muted text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="p-4 flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading...</div>
        ) : (
          <CustomChart data={data} chartType={config.chartType} />
        )}
      </div>
    </div>
  );
}

export function CustomChartManager({ dateRange }: { dateRange: { from: Date; to: Date } | null }) {
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [newField, setNewField] = useState("states");
  const [newType, setNewType] = useState<"bar" | "pie" | "line">("bar");
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => { setCharts(loadCharts()); }, []);

  function addChart() {
    const fieldLabel = AVAILABLE_FIELDS.find((f) => f.value === newField)?.label ?? newField;
    const config: ChartConfig = {
      id: `custom-${Date.now()}`,
      field: newField,
      chartType: newType,
      title: newTitle || fieldLabel,
    };
    const updated = [...charts, config];
    setCharts(updated);
    saveCharts(updated);
    setShowBuilder(false);
    setNewTitle("");
  }

  function removeChart(id: string) {
    const updated = charts.filter((c) => c.id !== id);
    setCharts(updated);
    saveCharts(updated);
  }

  return (
    <>
      {charts.map((config) => (
        <div key={config.id}>
          <CustomChartCard config={config} onRemove={() => removeChart(config.id)} dateRange={dateRange} />
        </div>
      ))}

      {showBuilder ? (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm">New Custom Chart</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Field</label>
              <select
                value={newField}
                onChange={(e) => setNewField(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-card px-2 text-sm"
              >
                {AVAILABLE_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Chart Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as "bar" | "pie" | "line")}
                className="mt-1 w-full h-9 rounded-md border border-input bg-card px-2 text-sm"
              >
                {CHART_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Title (optional)</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Auto-generated from field name"
              className="mt-1 w-full h-9 rounded-md border border-input bg-card px-3 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={addChart} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Add Chart</button>
            <button onClick={() => setShowBuilder(false)} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          </div>
        </div>
      ) : (
        <div>
          <button
            onClick={() => setShowBuilder(true)}
            className="flex items-center gap-2 rounded-lg border border-dashed w-full justify-center py-8 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Custom Chart
          </button>
        </div>
      )}
    </>
  );
}
