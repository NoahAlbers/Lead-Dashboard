"use client";

import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import { EmptyState } from "./dashboard-widget";

interface PartnerScorecardData {
  partnerName: string;
  referralCount: number;
  totalValue: number;
  avgValue: number;
  monthlyData: Array<{ month: string; count: number; value: number }>;
}

export function PartnerScorecard({ data }: { data: PartnerScorecardData }) {
  if (!data || data.referralCount === 0) return <EmptyState message="No referral data for this partner" />;

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Referrals</p>
          <p className="text-2xl font-bold mt-1">{data.referralCount}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Value</p>
          <p className="text-2xl font-bold mt-1">${data.totalValue.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground">Avg Value</p>
          <p className="text-2xl font-bold mt-1">${Math.round(data.avgValue).toLocaleString()}</p>
        </div>
      </div>

      {/* Monthly Referral Volume Chart */}
      {data.monthlyData.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Monthly Referral Volume</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyData}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip
                  formatter={(value, name) =>
                    name === "value" ? [`$${Number(value).toLocaleString()}`, "Value"] : [value, "Count"]
                  }
                />
                <Bar dataKey="count" fill="#a855f7" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
