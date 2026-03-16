"use client";

import { useState } from "react";
import { EmptyState } from "./dashboard-widget";

interface PartnerRow {
  partnerId: string;
  partnerName: string;
  referralCount: number;
  totalValue: number;
  avgValue: number;
  lastReferralDate: string | null;
}

type SortKey = "totalValue" | "referralCount" | "avgValue" | "partnerName" | "lastReferralDate";

function formatEstDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });
}

export function PartnerLeaderboard({ data }: { data: PartnerRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("totalValue");
  const [sortAsc, setSortAsc] = useState(false);

  if (!data || data.length === 0) return <EmptyState message="No referral partner data for this period" />;

  const sorted = [...data].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "partnerName") {
      cmp = a.partnerName.localeCompare(b.partnerName);
    } else if (sortKey === "lastReferralDate") {
      const da = a.lastReferralDate ? new Date(a.lastReferralDate).getTime() : 0;
      const db = b.lastReferralDate ? new Date(b.lastReferralDate).getTime() : 0;
      cmp = da - db;
    } else {
      cmp = (a[sortKey] as number) - (b[sortKey] as number);
    }
    return sortAsc ? cmp : -cmp;
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function SortIndicator({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return <span className="ml-1">{sortAsc ? "\u2191" : "\u2193"}</span>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left py-2 px-2 font-medium w-10">#</th>
            <th
              className="text-left py-2 px-2 font-medium cursor-pointer hover:text-foreground"
              onClick={() => handleSort("partnerName")}
            >
              Partner Name<SortIndicator col="partnerName" />
            </th>
            <th
              className="text-right py-2 px-2 font-medium cursor-pointer hover:text-foreground"
              onClick={() => handleSort("referralCount")}
            >
              # Referrals<SortIndicator col="referralCount" />
            </th>
            <th
              className="text-right py-2 px-2 font-medium cursor-pointer hover:text-foreground"
              onClick={() => handleSort("totalValue")}
            >
              Total Value<SortIndicator col="totalValue" />
            </th>
            <th
              className="text-right py-2 px-2 font-medium cursor-pointer hover:text-foreground"
              onClick={() => handleSort("avgValue")}
            >
              Avg Value<SortIndicator col="avgValue" />
            </th>
            <th
              className="text-right py-2 px-2 font-medium cursor-pointer hover:text-foreground"
              onClick={() => handleSort("lastReferralDate")}
            >
              Last Referral<SortIndicator col="lastReferralDate" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={row.partnerId} className="border-b last:border-0 hover:bg-muted/50">
              <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
              <td className="py-2 px-2 font-medium">{row.partnerName}</td>
              <td className="py-2 px-2 text-right">{row.referralCount}</td>
              <td className="py-2 px-2 text-right">${row.totalValue.toLocaleString()}</td>
              <td className="py-2 px-2 text-right">${Math.round(row.avgValue).toLocaleString()}</td>
              <td className="py-2 px-2 text-right text-muted-foreground">{formatEstDate(row.lastReferralDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
