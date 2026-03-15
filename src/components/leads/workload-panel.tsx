"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { WorkloadStat } from "@/actions/assignment.actions";
import { getLeadsForUser } from "@/actions/assignment.actions";
import { StatusBadge, TierBadge, ScoreBadge } from "@/components/shared/status-badge";
import { SlaBadge } from "@/components/leads/sla-badge";
import { AssignDropdown } from "@/components/leads/assign-dropdown";

type AssignedLead = Awaited<ReturnType<typeof getLeadsForUser>>[number];

interface WorkloadPanelProps {
  stats: WorkloadStat[];
  tierColorMap?: Record<string, string>;
}

export function WorkloadPanel({ stats, tierColorMap }: WorkloadPanelProps) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userLeads, setUserLeads] = useState<Record<string, AssignedLead[]>>({});
  const [isPending, startTransition] = useTransition();

  if (stats.length === 0) return <p className="text-sm text-muted-foreground">No active users.</p>;

  const maxTotal = Math.max(...stats.map((s) => s.total), 1);

  function handleToggle(userId: string) {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(userId);
    if (!userLeads[userId]) {
      startTransition(async () => {
        const leads = await getLeadsForUser(userId);
        setUserLeads((prev) => ({ ...prev, [userId]: leads }));
      });
    }
  }

  return (
    <div className="space-y-1">
      {stats.map((stat) => {
        const isExpanded = expandedUserId === stat.userId;
        const leads = userLeads[stat.userId];

        return (
          <div key={stat.userId}>
            <button
              onClick={() => handleToggle(stat.userId)}
              className="w-full text-left rounded-md p-2 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                    {stat.userName.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium">{stat.userName}</span>
                  <span className="text-[10px] text-muted-foreground">{stat.userRole}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{stat.total} leads</span>
                  {stat.slaBreached > 0 && (
                    <span className="rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-semibold">
                      {stat.slaBreached} SLA
                    </span>
                  )}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(stat.total / maxTotal) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                {stat.byStatus.NEW && <span>New: {stat.byStatus.NEW}</span>}
                {stat.byStatus.CONTACTED && <span>Contacted: {stat.byStatus.CONTACTED}</span>}
                {stat.byStatus.FOLLOW_UP_NEEDED && <span>Follow-Up: {stat.byStatus.FOLLOW_UP_NEEDED}</span>}
                {stat.byStatus.QUALIFIED && <span>Qualified: {stat.byStatus.QUALIFIED}</span>}
              </div>
            </button>

            {isExpanded && (
              <div className="ml-2 mr-1 mb-2 border-l-2 border-primary/20 pl-3">
                {isPending && !leads ? (
                  <p className="text-xs text-muted-foreground py-2">Loading...</p>
                ) : leads && leads.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No active leads</p>
                ) : leads ? (
                  <div className="divide-y">
                    {leads.map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between py-2 gap-2">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="text-sm font-medium text-primary hover:underline truncate block"
                          >
                            {lead.companyName || lead.fullName || "Unknown"}
                          </Link>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <ScoreBadge score={lead.score} />
                            <TierBadge tier={lead.qualityTier} colorMap={tierColorMap} />
                            <StatusBadge status={lead.status} />
                            <SlaBadge slaStatus={lead.slaStatus} compact />
                            {lead.state && (
                              <span className="text-[10px] text-muted-foreground">{lead.state}</span>
                            )}
                          </div>
                        </div>
                        <AssignDropdown
                          leadId={lead.id}
                          currentAssigneeId={stat.userId}
                          leadLabel={lead.companyName || lead.fullName || "Lead"}
                          compact
                          onAssigned={() => {
                            // Refresh this user's leads
                            startTransition(async () => {
                              const refreshed = await getLeadsForUser(stat.userId);
                              setUserLeads((prev) => ({ ...prev, [stat.userId]: refreshed }));
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
