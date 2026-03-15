import { EmptyState } from "./dashboard-widget";

interface FunnelData {
  new: number;
  contacted: number;
  qualified: number;
  won: number;
  lost: number;
  disqualified: number;
}

function pct(num: number, denom: number): string {
  if (denom === 0) return "0%";
  return `${Math.round((num / denom) * 100)}%`;
}

const stages = [
  { key: "new", label: "New", color: "#3b82f6" },
  { key: "contacted", label: "Contacted", color: "#06b6d4" },
  { key: "qualified", label: "Qualified", color: "#22c55e" },
  { key: "won", label: "Won", color: "#10b981" },
] as const;

export function PipelineFunnel({ data }: { data: FunnelData }) {
  if (data.new === 0) return <EmptyState />;

  const maxWidth = data.new;

  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const value = data[stage.key];
        const widthPct = maxWidth > 0 ? Math.max((value / maxWidth) * 100, 8) : 8;
        const prevValue = i > 0 ? data[stages[i - 1].key] : null;
        const convLabel = prevValue && prevValue > 0 ? `${pct(value, prevValue)}` : null;

        return (
          <div key={stage.key} className="flex items-center gap-2">
            <div className="w-20 text-xs text-muted-foreground text-right shrink-0">
              {stage.label}
            </div>
            <div className="flex-1 h-7 rounded bg-muted/50 overflow-hidden relative">
              <div
                className="h-full rounded flex items-center px-2 transition-all"
                style={{ width: `${widthPct}%`, backgroundColor: stage.color }}
              >
                <span className="text-xs font-semibold text-white">{value}</span>
              </div>
            </div>
            {convLabel && (
              <span className="text-[10px] text-muted-foreground w-10 shrink-0">{convLabel}</span>
            )}
          </div>
        );
      })}

      <div className="flex gap-4 mt-2 pt-2 border-t text-xs text-muted-foreground">
        <span>Lost: <strong className="text-red-500">{data.lost}</strong></span>
        <span>Disqualified: <strong className="text-red-500">{data.disqualified}</strong></span>
      </div>
    </div>
  );
}
