"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { ResponsiveGridLayout, useContainerWidth, type Layout, type LayoutItem, type ResponsiveLayouts } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const STORAGE_KEY = "dashboard-widget-layout";
const HIDDEN_KEY = "dashboard-widget-hidden";

function humanize(key: string): string {
  const names: Record<string, string> = {
    kpi: "KPI Cards", volume: "Lead Volume Over Time", "quality-donut": "Quality Distribution",
    "quality-trend": "Quality Trend", funnel: "Pipeline Funnel", status: "Status Breakdown",
    geo: "Geographic Heatmap", rules: "Rule Effectiveness", "avg-score": "Avg Score Over Time",
    trends: "Trends Over Time", recapture: "Abandoned Form Recapture", recent: "Recent Leads",
    "top-leads": "Top Leads by Score", "follow-ups": "Upcoming Follow-Ups",
    units: "Unit Distribution", rent: "Avg Rent Distribution", response: "Response Time",
    activity: "Activity Feed", "win-loss": "Win/Loss Ratio", "loss-reasons": "Loss Reasons",
    "win-rate-trend": "Win Rate Trend", "could-have-won": "Could Have Won",
    "partner-leaderboard": "Partner Leaderboard", custom: "Custom Charts",
  };
  return names[key] ?? key.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

interface OldLayoutItem {
  i: string;
  w: number; // legacy: 1 = half, 2 = full width
}

interface DashboardGridProps {
  children: React.ReactNode[];
  widgetKeys: string[];
  defaultLayout: OldLayoutItem[];
}

// Convert old {i, w} format to full react-grid-layout Layout
function buildDefaultRGLLayout(items: OldLayoutItem[]): Layout {
  const layout: LayoutItem[] = [];
  let x = 0;
  let y = 0;
  for (const item of items) {
    const w = item.w === 2 ? 12 : 6;
    const h = item.i === "kpi" ? 4 : item.i === "recent" ? 8 : item.i === "custom" ? 8 : item.i === "geo" ? 8 : 7;
    if (x + w > 12) { x = 0; y += h; }
    layout.push({
      i: item.i,
      x,
      y,
      w,
      h,
      minW: 4,
      minH: 3,
    });
    x += w;
    if (x >= 12) { x = 0; y += h; }
  }
  return layout;
}

export function DashboardGrid({ children, widgetKeys, defaultLayout }: DashboardGridProps) {
  const [mounted, setMounted] = useState(false);
  const defaultRGL = useMemo(() => buildDefaultRGLLayout(defaultLayout), [defaultLayout]);

  const { width, containerRef, mounted: widthReady } = useContainerWidth();

  const [layouts, setLayouts] = useState<ResponsiveLayouts>({ lg: defaultRGL });
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate it's react-grid-layout format
        if (parsed.lg && Array.isArray(parsed.lg) && parsed.lg.length > 0 && typeof parsed.lg[0].x === "number") {
          setLayouts(parsed);
        } else if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0].x === "number") {
          setLayouts({ lg: parsed });
        }
      }
    } catch { /* ignore */ }
    try {
      const savedHidden = localStorage.getItem(HIDDEN_KEY);
      if (savedHidden) setHidden(new Set(JSON.parse(savedHidden) as string[]));
    } catch { /* ignore */ }
  }, []);

  function toggleHidden(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  const handleLayoutChange = useCallback((_layout: Layout, allLayouts: ResponsiveLayouts) => {
    setLayouts(allLayouts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allLayouts));
  }, []);

  function resetLayout() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("dashboard-widget-order");
    localStorage.removeItem(HIDDEN_KEY);
    setLayouts({ lg: defaultRGL });
    setHidden(new Set());
  }

  const visibleKeys = widgetKeys.filter((k) => !hidden.has(k));

  const childMap = useMemo(
    () => Object.fromEntries(widgetKeys.map((k, i) => [k, children[i]])),
    [widgetKeys, children]
  );

  if (!mounted || !widthReady) {
    return (
      <div ref={containerRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {children}
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <div className="flex flex-wrap justify-end gap-2 mb-3">
        <div className="relative">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Widgets{hidden.size > 0 ? ` (${hidden.size} hidden)` : ""}
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-1 w-60 rounded-lg border bg-card p-2 shadow-lg max-h-80 overflow-y-auto">
                <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Show / hide widgets</p>
                {widgetKeys.map((key) => (
                  <label key={key} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!hidden.has(key)}
                      onChange={() => toggleHidden(key)}
                      className="h-4 w-4"
                    />
                    {humanize(key)}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          onClick={resetLayout}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Layout
        </button>
      </div>
      <ResponsiveGridLayout
        className="layout"
        width={width}
        layouts={layouts}
        breakpoints={{ lg: 1024, md: 768, sm: 0 }}
        cols={{ lg: 12, md: 12, sm: 1 }}
        rowHeight={40}
        onLayoutChange={handleLayoutChange}
        dragConfig={{ handle: ".widget-drag-handle" }}
        resizeConfig={{ handles: ["se"] }}
        margin={[24, 24]}
        containerPadding={[0, 0]}
      >
        {visibleKeys.map((key) => (
          <div key={key}>
            {childMap[key]}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
