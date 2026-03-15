"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TIER_COLORS } from "./chart-colors";
import { EmptyState } from "./dashboard-widget";

interface VolumeData {
  date: string;
  total: number;
  [tier: string]: number | string;
}

// Get unique tier keys from data
function getTierKeys(data: VolumeData[]): string[] {
  const keys = new Set<string>();
  for (const d of data) {
    for (const k of Object.keys(d)) {
      if (k !== "date" && k !== "total") keys.add(k);
    }
  }
  return [...keys];
}

export function LeadVolumeChart({ data }: { data: VolumeData[] }) {
  if (data.length === 0) return <EmptyState />;

  const tierKeys = getTierKeys(data);
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={formatted} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E4EC" }}
          labelFormatter={(l) => String(l)}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        {tierKeys.map((tier) => (
          <Bar
            key={tier}
            dataKey={tier}
            stackId="stack"
            fill={TIER_COLORS[tier] ?? "#8889A0"}
            radius={[0, 0, 0, 0]}
            name={tier}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
