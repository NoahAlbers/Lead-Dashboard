"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";

interface ResponseData {
  avgHours: number;
  distribution: { label: string; count: number }[];
}

export function ResponseTime({ data }: { data: ResponseData }) {
  const color = data.avgHours < 4 ? "text-green-600" : data.avgHours < 12 ? "text-amber-600" : "text-red-600";
  const bgColor = data.avgHours < 4 ? "bg-green-50" : data.avgHours < 12 ? "bg-amber-50" : "bg-red-50";

  return (
    <div className="space-y-3">
      <div className={`rounded-lg p-4 text-center ${bgColor}`}>
        <p className={`text-3xl font-bold ${color}`}>
          {data.avgHours > 0 ? `${data.avgHours}h` : "—"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">avg response time</p>
      </div>

      {data.distribution.length > 0 && data.distribution.some((d) => d.count > 0) && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.distribution} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9 }} />
            <YAxis hide />
            <Bar dataKey="count" fill="#3D5AF1" radius={[3, 3, 0, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
