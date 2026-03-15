"use client";

import { useState } from "react";
import { US_STATE_PATHS, STATE_ABBREV_TO_NAME } from "@/lib/us-states";
import { EmptyState } from "./dashboard-widget";
import { getStateFillColor } from "@/lib/state-colors";

interface StateData {
  state: string;
  count: number;
  units: number;
}

interface GeoHeatmapProps {
  data: StateData[];
  stateClassifications?: Record<string, string>;
}

// Build reverse map: full name → abbreviation for SVG lookup
const NAME_TO_ABBREV: Record<string, string> = {};
for (const [abbr, name] of Object.entries(STATE_ABBREV_TO_NAME)) {
  NAME_TO_ABBREV[name] = abbr;
}

function getColor(count: number, max: number): string {
  if (count === 0 || max === 0) return "#EEF1FE";
  const intensity = Math.min(count / max, 1);
  // Interpolate from light (#EEF1FE) to brand blue (#3D5AF1)
  const r = Math.round(238 + (61 - 238) * intensity);
  const g = Math.round(241 + (90 - 241) * intensity);
  const b = Math.round(254 + (241 - 254) * intensity);
  return `rgb(${r},${g},${b})`;
}

export function GeoHeatmap({ data, stateClassifications = {} }: GeoHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  if (data.length === 0) return <EmptyState />;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const dataMap: Record<string, StateData> = {};
  for (const d of data) {
    const abbrev = NAME_TO_ABBREV[d.state] ?? d.state;
    dataMap[abbrev] = d;
  }

  return (
    <div className="relative">
      <svg
        viewBox="100 0 900 600"
        className="w-full h-auto"
        onMouseLeave={() => setTooltip(null)}
      >
        {Object.entries(US_STATE_PATHS).map(([abbrev, path]) => {
          const stateData = dataMap[abbrev];
          const count = stateData?.count ?? 0;
          return (
            <path
              key={abbrev}
              d={path}
              fill={Object.keys(stateClassifications).length > 0
                ? getStateFillColor(stateClassifications[abbrev] ?? "unknown", count, maxCount)
                : getColor(count, maxCount)
              }
              stroke="#fff"
              strokeWidth={1}
              className="transition-colors cursor-pointer hover:opacity-80"
              onMouseEnter={(e) => {
                const name = STATE_ABBREV_TO_NAME[abbrev] ?? abbrev;
                const units = stateData?.units ?? 0;
                setTooltip({
                  x: e.clientX,
                  y: e.clientY,
                  text: `${name}: ${count} lead${count !== 1 ? "s" : ""}${units > 0 ? ` (${units.toLocaleString()} units)` : ""}`,
                });
              }}
              onMouseMove={(e) => {
                setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
      </svg>

      {tooltip && (
        <div
          className="fixed z-50 bg-foreground text-background text-xs rounded-md px-2.5 py-1.5 pointer-events-none whitespace-nowrap"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Color scale */}
      <div className="flex items-center gap-2 mt-2 justify-center">
        <span className="text-[10px] text-muted-foreground">0</span>
        <div className="w-24 h-2 rounded-full" style={{ background: "linear-gradient(to right, #EEF1FE, #3D5AF1)" }} />
        <span className="text-[10px] text-muted-foreground">{maxCount}</span>
      </div>
    </div>
  );
}
