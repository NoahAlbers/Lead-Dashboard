"use client";

import { useEffect, useState } from "react";
import { useFilterParams } from "./use-filter-params";

type Op = "gt" | "lt" | "eq" | "between";

const OP_LABELS: Record<Op, string> = {
  gt: "greater than (≥)",
  lt: "less than (≤)",
  eq: "equal to (=)",
  between: "between",
};

function deriveOp(min: string, max: string): Op {
  if (min && max) return min === max ? "eq" : "between";
  if (max && !min) return "lt";
  return "gt";
}

/**
 * One numeric field's filter: an operator dropdown (≥, ≤, =, between) plus one
 * or two number inputs. Maps to `{fieldKey}Min` / `{fieldKey}Max` URL params.
 * Values are committed on blur / Enter to avoid a navigation per keystroke.
 */
export function NumericFilterRow({
  label,
  fieldKey,
  unit,
}: {
  label: string;
  fieldKey: string;
  unit?: string;
}) {
  const { searchParams, setMany } = useFilterParams();
  const minKey = `${fieldKey}Min`;
  const maxKey = `${fieldKey}Max`;
  const urlMin = searchParams.get(minKey) ?? "";
  const urlMax = searchParams.get(maxKey) ?? "";

  const [op, setOp] = useState<Op>(() => deriveOp(urlMin, urlMax));
  const [v1, setV1] = useState(urlMin || urlMax);
  const [v2, setV2] = useState(urlMax);

  // Re-sync when the URL changes underneath us (e.g. applying a saved view).
  useEffect(() => {
    setOp(deriveOp(urlMin, urlMax));
    setV1(urlMin || urlMax);
    setV2(urlMax);
  }, [urlMin, urlMax]);

  function commit(nextOp: Op, a: string, b: string) {
    const av = a.trim();
    const bv = b.trim();
    if (nextOp === "gt") setMany({ [minKey]: av || null, [maxKey]: null });
    else if (nextOp === "lt") setMany({ [minKey]: null, [maxKey]: av || null });
    else if (nextOp === "eq") setMany({ [minKey]: av || null, [maxKey]: av || null });
    else setMany({ [minKey]: av || null, [maxKey]: bv || null });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
      <select
        value={op}
        onChange={(e) => {
          const next = e.target.value as Op;
          setOp(next);
          commit(next, v1, v2);
        }}
        className="h-8 rounded-md border border-input bg-card px-2 text-xs"
      >
        {(Object.keys(OP_LABELS) as Op[]).map((o) => (
          <option key={o} value={o}>
            {OP_LABELS[o]}
          </option>
        ))}
      </select>
      <input
        type="number"
        value={v1}
        onChange={(e) => setV1(e.target.value)}
        onBlur={() => commit(op, v1, v2)}
        onKeyDown={(e) => e.key === "Enter" && commit(op, v1, v2)}
        placeholder={op === "between" ? "min" : "value"}
        className="h-8 w-24 rounded-md border border-input bg-card px-2 text-sm"
      />
      {op === "between" && (
        <>
          <span className="text-xs text-muted-foreground">and</span>
          <input
            type="number"
            value={v2}
            onChange={(e) => setV2(e.target.value)}
            onBlur={() => commit(op, v1, v2)}
            onKeyDown={(e) => e.key === "Enter" && commit(op, v1, v2)}
            placeholder="max"
            className="h-8 w-24 rounded-md border border-input bg-card px-2 text-sm"
          />
        </>
      )}
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
    </div>
  );
}
