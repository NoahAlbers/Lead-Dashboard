import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  className?: string;
  /** Daily values, oldest first. Drawn as a small sparkline. */
  spark?: number[];
  /** Percent change vs the prior period; null hides the badge. */
  delta?: number | null;
  deltaLabel?: string;
  hint?: string;
}

function Sparkline({ values }: { values: number[] }) {
  const w = 96;
  const h = 28;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => [i * step, h - 2 - (v / max) * (h - 4)] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-primary shrink-0" aria-hidden="true">
      <polygon points={area} fill="currentColor" opacity="0.10" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={last[0]} cy={last[1]} r="2.5" fill="currentColor" />}
    </svg>
  );
}

export function StatCard({ label, value, icon: Icon, className, spark, delta, deltaLabel, hint }: StatCardProps) {
  const showDelta = typeof delta === "number" && Number.isFinite(delta);
  const up = showDelta && delta! > 0;
  const flat = showDelta && delta === 0;
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground truncate" title={hint ?? label}>{label}</p>
          <p className="text-2xl font-bold mt-1 truncate">{value}</p>
        </div>
        {spark ? <Sparkline values={spark} /> : <Icon className="h-8 w-8 text-muted-foreground/50 shrink-0" />}
      </div>
      {showDelta && (
        <p className={cn("mt-1.5 text-xs font-medium", flat ? "text-muted-foreground" : up ? "text-emerald-600" : "text-red-600")}>
          {flat ? "No change" : `${up ? "▲" : "▼"} ${Math.abs(delta!)}%`}
          <span className="ml-1 font-normal text-muted-foreground">{deltaLabel ?? "vs prior 7 days"}</span>
        </p>
      )}
    </div>
  );
}
