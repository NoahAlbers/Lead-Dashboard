"use client";

import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { Inbox, Star, Phone, Building2 } from "lucide-react";

interface KPIData {
  totalLeads: number;
  prevTotalLeads: number;
  avgScore: number;
  prevAvgScore: number;
  contactRate: number;
  prevContactRate: number;
  estUnits: number;
  sparkline: { date: string; count: number }[];
}

function trend(current: number, prev: number): { pct: number; up: boolean } {
  if (prev === 0) return { pct: current > 0 ? 100 : 0, up: current > 0 };
  const pct = Math.round(((current - prev) / prev) * 100);
  return { pct: Math.abs(pct), up: pct >= 0 };
}

function KPICard({
  label,
  value,
  prev,
  icon: Icon,
  sparkline,
  format,
  goodUp = true,
}: {
  label: string;
  value: number;
  prev: number;
  icon: typeof Inbox;
  sparkline: { date: string; count: number }[];
  format?: (v: number) => string;
  goodUp?: boolean;
}) {
  const t = trend(value, prev);
  const isGood = goodUp ? t.up : !t.up;
  const display = format ? format(value) : String(value);

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col justify-between min-h-[120px]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{display}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <div className="flex items-end justify-between mt-2">
        {t.pct > 0 && (
          <span className={`text-xs font-medium ${isGood ? "text-green-600" : "text-red-500"}`}>
            {t.up ? "↑" : "↓"}{t.pct}%
          </span>
        )}
        {sparkline.length > 1 && (
          <div className="w-20 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline}>
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3D5AF1"
                  fill="#3D5AF1"
                  fillOpacity={0.1}
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export function KPICards({ data }: { data: KPIData }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KPICard label="Total Leads" value={data.totalLeads} prev={data.prevTotalLeads} icon={Inbox} sparkline={data.sparkline} />
      <KPICard label="Avg Score" value={data.avgScore} prev={data.prevAvgScore} icon={Star} sparkline={data.sparkline} />
      <KPICard label="Contact Rate" value={data.contactRate} prev={data.prevContactRate} icon={Phone} sparkline={[]} format={(v) => `${v}%`} />
      <KPICard label="Est. Units" value={data.estUnits} prev={0} icon={Building2} sparkline={[]} format={(v) => v.toLocaleString()} />
    </div>
  );
}
