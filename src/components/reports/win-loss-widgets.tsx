"use client";

import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis,
  LineChart, Line,
} from "recharts";
import { EmptyState } from "./dashboard-widget";

// Colors for outcome types
const OUTCOME_COLORS: Record<string, string> = {
  won: "#10b981",
  lost: "#6b7280",
  disqualified: "#ef4444",
  referred_out: "#a855f7",
};

const COULD_HAVE_WON_COLORS: Record<string, string> = {
  yes: "#ef4444",
  maybe: "#f59e0b",
  no: "#6b7280",
};

// 1. Win/Loss Ratio — Donut PieChart
interface WinLossData {
  outcomeType: string;
  count: number;
}

export function WinLossRatio({ data }: { data: WinLossData[] }) {
  if (data.length === 0 || data.every((d) => d.count === 0)) return <EmptyState />;

  const total = data.reduce((s, d) => s + d.count, 0);
  const labels: Record<string, string> = {
    won: "Won",
    lost: "Lost",
    disqualified: "Disqualified",
    referred_out: "Referred Out",
  };

  const formatted = data.map((d) => ({
    ...d,
    name: labels[d.outcomeType] ?? d.outcomeType,
  }));

  return (
    <div className="relative h-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={formatted}
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={85}
            dataKey="count"
            nameKey="name"
            paddingAngle={2}
          >
            {formatted.map((d) => (
              <Cell key={d.outcomeType} fill={OUTCOME_COLORS[d.outcomeType] ?? "#8889A0"} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginBottom: 30 }}>
        <div className="text-center">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-[10px] text-muted-foreground">outcomes</p>
        </div>
      </div>
    </div>
  );
}

// 2. Loss Reasons — Horizontal BarChart
interface ReasonData {
  reason: string;
  count: number;
}

export function LossReasons({ data }: { data: ReasonData[] }) {
  if (data.length === 0) return <EmptyState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="reason" tick={{ fontSize: 11 }} width={100} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="count" fill="#6b7280" radius={[0, 4, 4, 0]} barSize={18} name="Losses" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// 3. Win Rate Trend — LineChart
interface WinRateData {
  month: string;
  winRate: number;
}

export function WinRateTrend({ data }: { data: WinRateData[] }) {
  if (data.length === 0) return <EmptyState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
        <XAxis dataKey="month" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value) => [`${value}%`, "Win Rate"]}
        />
        <Line
          type="monotone"
          dataKey="winRate"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 3, fill: "#10b981" }}
          name="Win Rate"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// 4. Avg Deal Value — Stat card
interface AvgDealValueData {
  avgValue: number;
  count: number;
}

export function AvgDealValue({ data }: { data: AvgDealValueData }) {
  if (data.count === 0) return <EmptyState message="No won deals yet" />;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <p className="text-3xl font-bold text-emerald-600">
        ${data.avgValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </p>
      <p className="text-sm text-muted-foreground">avg contract value</p>
      <p className="text-xs text-muted-foreground mt-1">
        across <strong>{data.count}</strong> won deal{data.count !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

// 5. Could Have Won — PieChart
interface CouldHaveWonData {
  answer: string;
  count: number;
}

export function CouldHaveWon({ data }: { data: CouldHaveWonData[] }) {
  if (data.length === 0 || data.every((d) => d.count === 0)) return <EmptyState message="No lost leads with data" />;

  const labels: Record<string, string> = { yes: "Yes", maybe: "Maybe", no: "No" };
  const formatted = data.map((d) => ({
    ...d,
    name: labels[d.answer] ?? d.answer,
  }));
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="relative h-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={formatted}
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={85}
            dataKey="count"
            nameKey="name"
            paddingAngle={2}
          >
            {formatted.map((d) => (
              <Cell key={d.answer} fill={COULD_HAVE_WON_COLORS[d.answer] ?? "#8889A0"} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginBottom: 30 }}>
        <div className="text-center">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-[10px] text-muted-foreground">lost leads</p>
        </div>
      </div>
    </div>
  );
}

// 6. Win Reasons — Horizontal BarChart
export function WinReasons({ data }: { data: ReasonData[] }) {
  if (data.length === 0) return <EmptyState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="reason" tick={{ fontSize: 11 }} width={100} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} barSize={18} name="Wins" />
      </BarChart>
    </ResponsiveContainer>
  );
}
