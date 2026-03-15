import Link from "next/link";
import { ScoreBadge, TierBadge } from "@/components/shared/status-badge";
import { EmptyState } from "./dashboard-widget";

interface Lead {
  id: string;
  companyName: string | null;
  fullName: string | null;
  score: number | null;
  qualityTier: string | null;
  accountVolume: string | null;
  status: string;
}

export function TopLeads({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) return <EmptyState />;

  return (
    <div className="space-y-1.5 max-h-[260px] overflow-auto">
      {leads.map((lead, i) => (
        <div key={lead.id} className="flex items-center gap-2 py-1.5 text-xs">
          <span className="text-muted-foreground w-5 text-right tabular-nums font-medium">{i + 1}.</span>
          <Link href={`/leads/${lead.id}`} className="text-primary hover:underline font-medium flex-1 truncate">
            {lead.companyName || lead.fullName || "—"}
          </Link>
          <ScoreBadge score={lead.score} />
          <TierBadge tier={lead.qualityTier} />
          <span className="text-muted-foreground tabular-nums w-12 text-right">{lead.accountVolume || "—"}</span>
          {lead.status === "NEW" && (
            <span className="rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[9px] font-medium">NEW</span>
          )}
        </div>
      ))}
    </div>
  );
}
