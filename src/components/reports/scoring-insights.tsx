"use client";

import { Lightbulb } from "lucide-react";

type Signal =
  | "strong_positive"
  | "positive"
  | "neutral"
  | "negative"
  | "misleading"
  | "insufficient_data";

export interface RuleInsight {
  name: string;
  points: number;
  matched: number;
  avgImpact: number;
  pctOfLeads: number;
  winRate: number;
  baselineWinRate: number;
  lift: number;
  sampleSize: number;
  signal: Signal;
}

export interface ScoringInsightsProps {
  data: RuleInsight[];
  insights: string[];
}

const SIGNAL_BADGES: Record<Signal, { label: string; className: string }> = {
  strong_positive: {
    label: "Strong +",
    className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  },
  positive: {
    label: "Positive",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  neutral: {
    label: "Neutral",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
  negative: {
    label: "Negative",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  misleading: {
    label: "Misleading",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  insufficient_data: {
    label: "Insufficient data",
    className: "bg-gray-100 text-gray-500 italic dark:bg-gray-800 dark:text-gray-500",
  },
};

function liftColor(lift: number): string {
  if (lift === 0) return "text-muted-foreground";
  if (lift >= 1.5) return "text-green-600 dark:text-green-400";
  if (lift < 0.8) return "text-red-500 dark:text-red-400";
  return "text-muted-foreground";
}

export function ScoringInsights({ data, insights }: ScoringInsightsProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[120px] text-sm text-muted-foreground">
        No data for this period
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-auto max-h-[280px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b text-muted-foreground">
              <th className="text-left py-1.5 font-medium">Rule</th>
              <th className="text-right py-1.5 font-medium">Pts</th>
              <th className="text-right py-1.5 font-medium">Matched</th>
              <th className="text-right py-1.5 font-medium">Win Rate</th>
              <th className="text-right py-1.5 font-medium">Lift</th>
              <th className="text-right py-1.5 font-medium">Signal</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const badge = SIGNAL_BADGES[r.signal];
              return (
                <tr key={r.name} className="border-b last:border-0">
                  <td className="py-1.5 max-w-[130px] truncate" title={r.name}>
                    {r.name}
                  </td>
                  <td
                    className={`py-1.5 text-right tabular-nums font-medium ${
                      r.points >= 0 ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {r.points >= 0 ? "+" : ""}
                    {r.points}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{r.matched}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {r.sampleSize > 0 ? `${r.winRate.toFixed(1)}%` : "-"}
                  </td>
                  <td className={`py-1.5 text-right tabular-nums font-medium ${liftColor(r.lift)}`}>
                    {r.lift > 0 ? `${r.lift.toFixed(2)}x` : "-"}
                  </td>
                  <td className="py-1.5 text-right">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] leading-tight font-medium whitespace-nowrap ${badge.className}`}
                    >
                      {r.signal === "insufficient_data"
                        ? `${badge.label} (${r.sampleSize})`
                        : badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Insights Panel */}
      {insights.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-xs font-semibold">Insights</span>
          </div>
          <ul className="space-y-1.5">
            {insights.map((insight, i) => (
              <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                <span className="shrink-0 mt-0.5">&#x2022;</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
