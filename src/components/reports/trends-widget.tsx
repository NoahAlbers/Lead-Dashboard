"use client";

import { useMemo } from "react";
import { useWidgetPref } from "@/lib/use-widget-pref";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

interface DailyPoint {
  date: string; // yyyy-MM-dd
  leads: number;
  abandoned: number;
  won: number;
  lost: number;
  referred: number;
}

type Granularity = "weekly" | "monthly";

function bucketKey(date: string, granularity: Granularity): string {
  const d = new Date(`${date}T00:00:00`);
  if (granularity === "monthly") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  // Weekly: bucket by the Monday of that week
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function bucketLabel(key: string, granularity: Granularity): string {
  if (granularity === "monthly") {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const SERIES = [
  { key: "leads", label: "New Inquiries", color: "#3D5AF1" },
  { key: "abandoned", label: "Abandons", color: "#F59E0B" },
  { key: "won", label: "Won", color: "#16A34A" },
  { key: "lost", label: "Lost", color: "#DC2626" },
  { key: "referred", label: "Referred Out", color: "#9333EA" },
] as const;

export function TrendsWidget({ data }: { data: DailyPoint[] }) {
  const [granularity, setGranularity] = useWidgetPref<Granularity>("trends.granularity", "weekly");

  const series = useMemo(() => {
    const buckets: Record<string, DailyPoint & { label: string }> = {};
    for (const point of data) {
      const key = bucketKey(point.date, granularity);
      if (!buckets[key]) {
        buckets[key] = { date: key, label: bucketLabel(key, granularity), leads: 0, abandoned: 0, won: 0, lost: 0, referred: 0 };
      }
      buckets[key].leads += point.leads;
      buckets[key].abandoned += point.abandoned;
      buckets[key].won += point.won;
      buckets[key].lost += point.lost;
      buckets[key].referred += point.referred;
    }
    return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, granularity]);

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-1">
        {(["weekly", "monthly"] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGranularity(g)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              granularity === g
                ? "bg-primary text-primary-foreground"
                : "border text-muted-foreground hover:text-foreground"
            }`}
          >
            {g === "weekly" ? "Weekly" : "Monthly"}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
