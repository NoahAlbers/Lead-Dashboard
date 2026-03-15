import Link from "next/link";
import { StatusBadge, TierBadge, ScoreBadge } from "@/components/shared/status-badge";
import { EmptyState } from "./dashboard-widget";

interface Lead {
  id: string;
  createdAt: string;
  companyName: string | null;
  fullName: string | null;
  score: number | null;
  qualityTier: string | null;
  status: string;
  accountVolume: string | null;
  state: string | null;
}

export function RecentLeadsTable({ leads, tierColorMap }: { leads: Lead[]; tierColorMap?: Record<string, string> }) {
  if (leads.length === 0) return <EmptyState />;

  return (
    <div>
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left py-2 font-medium">Date</th>
              <th className="text-left py-2 font-medium">Company</th>
              <th className="text-left py-2 font-medium">Contact</th>
              <th className="text-right py-2 font-medium">Score</th>
              <th className="text-left py-2 font-medium">Tier</th>
              <th className="text-left py-2 font-medium">Status</th>
              <th className="text-right py-2 font-medium">Units</th>
              <th className="text-left py-2 font-medium">State</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-2 whitespace-nowrap">
                  {new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}
                </td>
                <td className="py-2">
                  <Link href={`/leads/${lead.id}`} className="text-primary hover:underline font-medium">
                    {lead.companyName || "—"}
                  </Link>
                </td>
                <td className="py-2">{lead.fullName || "—"}</td>
                <td className="py-2 text-right"><ScoreBadge score={lead.score} /></td>
                <td className="py-2"><TierBadge tier={lead.qualityTier} colorMap={tierColorMap} /></td>
                <td className="py-2"><StatusBadge status={lead.status as never} /></td>
                <td className="py-2 text-right tabular-nums">{lead.accountVolume || "—"}</td>
                <td className="py-2">{lead.state || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-right">
        <Link href="/leads" className="text-xs text-primary hover:underline">View All →</Link>
      </div>
    </div>
  );
}
