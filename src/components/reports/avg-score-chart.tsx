"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { EmptyState } from "./dashboard-widget";

interface ScoreData {
  date: string;
  avgScore: number;
}

export function AvgScoreChart({ data }: { data: ScoreData[] }) {
  if (data.length === 0) return <EmptyState />;

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={formatted} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <ReferenceLine y={80} stroke="#16a34a" strokeDasharray="4 4" label={{ value: "A Tier", fontSize: 10, fill: "#16a34a" }} />
        <Line
          type="monotone"
          dataKey="avgScore"
          stroke="#3D5AF1"
          strokeWidth={2}
          dot={false}
          name="Avg Score"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
