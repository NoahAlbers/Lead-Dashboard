"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { TIER_COLORS } from "./chart-colors";
import { EmptyState } from "./dashboard-widget";

interface TierData {
  tier: string;
  count: number;
}

export function QualityDonut({ data }: { data: TierData[] }) {
  if (data.length === 0 || data.every((d) => d.count === 0)) return <EmptyState />;

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={85}
            dataKey="count"
            nameKey="tier"
            paddingAngle={2}
          >
            {data.map((d) => (
              <Cell key={d.tier} fill={TIER_COLORS[d.tier] ?? "#8889A0"} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginBottom: 30 }}>
        <div className="text-center">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-[10px] text-muted-foreground">leads</p>
        </div>
      </div>
    </div>
  );
}
