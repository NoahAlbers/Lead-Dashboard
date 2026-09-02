"use client";

import type { FormFunnelData } from "@/actions/form-funnel.actions";

/** Step-by-step drop-off for the intake form, from the tracked sessions. */
export function FormFunnel({ data }: { data: FormFunnelData }) {
  const { sessions, completed, reachedContact, steps, devices, pitchSkipRate, days } = data;
  const max = Math.max(1, ...steps.map((s) => s.reached));
  const pct = (n: number) => (sessions ? Math.round((n / sessions) * 100) : 0);

  if (sessions === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No tracked form sessions in the last {days} days yet. Data appears once the instrumented form is live.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md border p-2 text-center">
          <p className="text-lg font-bold">{sessions}</p>
          <p className="text-[11px] text-muted-foreground">Sessions</p>
        </div>
        <div className="rounded-md border p-2 text-center">
          <p className="text-lg font-bold text-primary">{pct(reachedContact)}%</p>
          <p className="text-[11px] text-muted-foreground">Gave contact info</p>
        </div>
        <div className="rounded-md border p-2 text-center">
          <p className="text-lg font-bold text-emerald-600">{pct(completed)}%</p>
          <p className="text-[11px] text-muted-foreground">Completed</p>
        </div>
      </div>

      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {steps.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-xs">
            <span className={`w-36 shrink-0 truncate ${s.pitch ? "italic text-muted-foreground" : ""}`} title={s.key}>{s.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${s.pitch ? "bg-primary/40" : "bg-primary"}`} style={{ width: `${(s.reached / max) * 100}%` }} />
            </div>
            <span className="w-10 text-right tabular-nums">{s.reached}</span>
            <span className={`w-12 text-right tabular-nums ${s.dropped > 0 ? "text-red-600" : "text-muted-foreground/50"}`} title="Left at this step">
              {s.dropped > 0 ? `-${s.dropped}` : ""}
            </span>
            <span className="w-10 text-right tabular-nums text-muted-foreground" title="Median time on step">
              {s.medianDwellSec != null ? `${s.medianDwellSec}s` : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-[11px] text-muted-foreground">
        {devices.map((d) => (
          <span key={d.device}>{d.device}: {d.sessions} ({d.sessions ? Math.round((d.completed / d.sessions) * 100) : 0}% done)</span>
        ))}
        {pitchSkipRate != null && <span>Pitch screens skipped in under 2s: {pitchSkipRate}%</span>}
      </div>
    </div>
  );
}
