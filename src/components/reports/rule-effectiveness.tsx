import { EmptyState } from "./dashboard-widget";

interface RuleData {
  name: string;
  matched: number;
  avgImpact: number;
  pctOfLeads: number;
}

export function RuleEffectiveness({ data }: { data: RuleData[] }) {
  if (data.length === 0) return <EmptyState />;

  return (
    <div className="overflow-auto max-h-[260px]">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b text-muted-foreground">
            <th className="text-left py-1.5 font-medium">Rule</th>
            <th className="text-right py-1.5 font-medium">Matched</th>
            <th className="text-right py-1.5 font-medium">Avg Impact</th>
            <th className="text-right py-1.5 font-medium">% Leads</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr
              key={r.name}
              className={`border-b last:border-0 ${r.matched === 0 ? "bg-amber-50" : r.pctOfLeads >= 95 ? "bg-blue-50" : ""}`}
            >
              <td className="py-1.5 max-w-[140px] truncate">{r.name}</td>
              <td className="py-1.5 text-right tabular-nums">{r.matched}</td>
              <td className={`py-1.5 text-right tabular-nums font-medium ${r.avgImpact >= 0 ? "text-green-600" : "text-red-500"}`}>
                {r.avgImpact >= 0 ? "+" : ""}{r.avgImpact}
              </td>
              <td className="py-1.5 text-right tabular-nums">{r.pctOfLeads}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
