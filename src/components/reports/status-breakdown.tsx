"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { STATUS_COLORS, STATUS_LABELS } from "./chart-colors";
import { EmptyState } from "./dashboard-widget";

interface StatusData {
  status: string;
  count: number;
}

export function StatusBreakdown({ data }: { data: StatusData[] }) {
  if (data.length === 0) return <EmptyState />;

  const formatted = data.map((d) => ({
    ...d,
    label: STATUS_LABELS[d.status] ?? d.status,
    fill: STATUS_COLORS[d.status] ?? "#8889A0",
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={formatted} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={80} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
          {formatted.map((d, i) => (
            <Cell key={i} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
