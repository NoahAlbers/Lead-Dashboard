"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { EmptyState } from "./dashboard-widget";

interface BucketData {
  label: string;
  count: number;
}

export function UnitDistribution({ data }: { data: BucketData[] }) {
  if (data.every((d) => d.count === 0)) return <EmptyState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="count" fill="#3D5AF1" radius={[4, 4, 0, 0]} barSize={28} name="Leads" />
      </BarChart>
    </ResponsiveContainer>
  );
}
