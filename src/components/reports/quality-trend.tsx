"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TIER_COLORS } from "./chart-colors";
import { EmptyState } from "./dashboard-widget";

interface VolumeData {
  date: string;
  [tier: string]: number | string;
}

export function QualityTrend({ data, tierColorMap }: { data: VolumeData[]; tierColorMap?: Record<string, string> }) {
  if (data.length === 0) return <EmptyState />;

  const tierKeys = new Set<string>();
  for (const d of data) {
    for (const k of Object.keys(d)) {
      if (k !== "date" && k !== "total") tierKeys.add(k);
    }
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={formatted} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        {[...tierKeys].map((tier) => (
          <Area
            key={tier}
            type="monotone"
            dataKey={tier}
            stackId="1"
            stroke={tierColorMap?.[tier] ?? TIER_COLORS[tier] ?? "#8889A0"}
            fill={tierColorMap?.[tier] ?? TIER_COLORS[tier] ?? "#8889A0"}
            fillOpacity={0.6}
            name={tier}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
