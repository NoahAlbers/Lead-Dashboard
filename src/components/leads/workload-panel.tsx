"use client";

import type { WorkloadStat } from "@/actions/assignment.actions";

export function WorkloadPanel({ stats }: { stats: WorkloadStat[] }) {
  if (stats.length === 0) return <p className="text-sm text-muted-foreground">No active users.</p>;

  const maxTotal = Math.max(...stats.map((s) => s.total), 1);

  return (
    <div className="space-y-3">
      {stats.map((stat) => (
        <div key={stat.userId} className="space-y-1">
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
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(stat.total / maxTotal) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex gap-2 text-[10px] text-muted-foreground">
            {stat.byStatus.NEW && <span>New: {stat.byStatus.NEW}</span>}
            {stat.byStatus.CONTACTED && <span>Contacted: {stat.byStatus.CONTACTED}</span>}
            {stat.byStatus.FOLLOW_UP_NEEDED && <span>Follow-Up: {stat.byStatus.FOLLOW_UP_NEEDED}</span>}
            {stat.byStatus.QUALIFIED && <span>Qualified: {stat.byStatus.QUALIFIED}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
