"use client";

interface RecaptureFunnelProps {
  data: {
    steps: Array<{ step: string; count: number }>;
    enrollments: {
      total: number;
      active: number;
      converted: number;
      stopped: number;
      exhausted: number;
      recoveryRate: number;
      emailsSent: number;
    };
  };
}

const STEP_LABELS: Record<string, string> = {
  form_opened: "Opened form",
  contact_info: "Entered contact info",
  debt_types: "Picked debt types",
  portfolio_details: "Portfolio details",
};

export function RecaptureFunnel({ data }: RecaptureFunnelProps) {
  const { steps, enrollments } = data;
  const max = Math.max(1, ...steps.map((s) => s.count));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border p-2">
          <div className="text-xl font-bold">{enrollments.total}</div>
          <div className="text-xs text-muted-foreground">Enrolled</div>
        </div>
        <div className="rounded-lg border p-2">
          <div className="text-xl font-bold text-green-600">{enrollments.converted}</div>
          <div className="text-xs text-muted-foreground">Recovered ({enrollments.recoveryRate}%)</div>
        </div>
        <div className="rounded-lg border p-2">
          <div className="text-xl font-bold text-amber-600">{enrollments.active}</div>
          <div className="text-xs text-muted-foreground">Active now</div>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Abandons by last step reached
        </p>
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No abandoned sessions recorded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {steps.map((s) => (
              <div key={s.step} className="flex items-center gap-2 text-sm">
                <span className="w-40 shrink-0 truncate text-muted-foreground" title={s.step}>
                  {STEP_LABELS[s.step] ?? s.step}
                </span>
                <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
                  <div
                    className="h-full rounded bg-amber-400"
                    style={{ width: `${Math.max(4, (s.count / max) * 100)}%` }}
                  />
                </div>
                <span className="w-8 text-right font-medium tabular-nums">{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {enrollments.emailsSent} recapture email{enrollments.emailsSent === 1 ? "" : "s"} sent ·{" "}
        {enrollments.stopped} stopped · {enrollments.exhausted} ran the full sequence
      </p>
    </div>
  );
}
