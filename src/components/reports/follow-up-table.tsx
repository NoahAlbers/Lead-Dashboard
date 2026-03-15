import Link from "next/link";
import { EmptyState } from "./dashboard-widget";

interface Lead {
  id: string;
  companyName: string | null;
  fullName: string | null;
  lastActivityAt: string | null;
  daysSince: number;
}

export function FollowUpTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) return <EmptyState message="No follow-ups needed" />;

  return (
    <div className="space-y-1 max-h-[260px] overflow-auto">
      {leads.map((lead) => {
        const urgency = lead.daysSince >= 7 ? "bg-red-50" : lead.daysSince >= 3 ? "bg-amber-50" : "";
        return (
          <div key={lead.id} className={`flex items-center gap-2 py-1.5 px-2 rounded text-xs ${urgency}`}>
            <Link href={`/leads/${lead.id}`} className="text-primary hover:underline font-medium flex-1 truncate">
              {lead.companyName || lead.fullName || "—"}
            </Link>
            <span className="text-muted-foreground whitespace-nowrap">
              {lead.lastActivityAt
                ? new Date(lead.lastActivityAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })
                : "—"
              }
            </span>
            <span className={`tabular-nums font-semibold ${lead.daysSince >= 7 ? "text-red-600" : lead.daysSince >= 3 ? "text-amber-600" : "text-muted-foreground"}`}>
              {lead.daysSince}d
            </span>
          </div>
        );
      })}
    </div>
  );
}
