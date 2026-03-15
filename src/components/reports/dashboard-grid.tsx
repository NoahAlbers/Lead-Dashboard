"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { RotateCcw } from "lucide-react";
import { ResponsiveGridLayout, useContainerWidth, type Layout, type LayoutItem, type ResponsiveLayouts } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const STORAGE_KEY = "dashboard-widget-layout";

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
    const h = item.i === "kpi" ? 5 : item.i === "recent" ? 8 : item.i === "custom" ? 8 : item.i === "geo" ? 8 : 7;
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
  }, []);

  const handleLayoutChange = useCallback((_layout: Layout, allLayouts: ResponsiveLayouts) => {
    setLayouts(allLayouts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allLayouts));
  }, []);

  function resetLayout() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("dashboard-widget-order");
    setLayouts({ lg: defaultRGL });
  }

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
      <div className="flex justify-end mb-3">
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
        {widgetKeys.map((key) => (
          <div key={key}>
            {childMap[key]}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
