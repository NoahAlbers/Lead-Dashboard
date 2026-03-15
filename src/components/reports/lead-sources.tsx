"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { EmptyState } from "./dashboard-widget";

interface SourceData {
  source: string;
  count: number;
}

const SOURCE_COLORS: Record<string, string> = {
  "Direct": "#6b7280",
  "Google (organic)": "#16a34a",
  "Google (ads)": "#eab308",
  "Social Media": "#3b82f6",
  "Other": "#8889A0",
};

export function LeadSources({ data }: { data: SourceData[] }) {
  if (data.length === 0) return <EmptyState />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} width={110} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((d, i) => (
            <Cell key={i} fill={SOURCE_COLORS[d.source] ?? "#3D5AF1"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
