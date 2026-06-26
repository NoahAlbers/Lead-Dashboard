"use client";

import { ChevronDown, Check } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { STATE_ABBREV_TO_NAME } from "@/lib/us-states";
import { getStateColor } from "@/lib/state-colors";
import { useFilterParams } from "./use-filter-params";

const CLASS_MODES: { value: string; label: string }[] = [
  { value: "any_good", label: "Any good" },
  { value: "only_good", label: "Only good" },
  { value: "any_bad", label: "Any bad" },
  { value: "only_bad", label: "Only bad" },
  { value: "mixed", label: "Mixed" },
  { value: "unknown", label: "Unknown" },
];

const STATE_OPTIONS = Object.entries(STATE_ABBREV_TO_NAME)
  .map(([abbrev, name]) => ({ abbrev, name }))
  .sort((a, b) => a.abbrev.localeCompare(b.abbrev));

/**
 * State filtering: classification modes (good/bad/mixed/unknown over a lead's
 * combined state set) AND an explicit multi-select of specific states with an
 * any/none operator. Both write URL params (`stateClass`, `states`, `statesOp`).
 */
export function StateFilterControl({
  stateClassifications,
}: {
  stateClassifications: Record<string, string>;
}) {
  const { searchParams, setParam, setMany } = useFilterParams();
  const activeClass = searchParams.get("stateClass");
  const statesOp = searchParams.get("statesOp") === "none" ? "none" : "any";
  const selected = new Set(
    (searchParams.get("states") ?? "").split(",").filter(Boolean)
  );

  function toggleState(abbrev: string) {
    const next = new Set(selected);
    if (next.has(abbrev)) next.delete(abbrev);
    else next.add(abbrev);
    setParam("states", next.size ? Array.from(next).join(",") : null);
  }

  return (
    <div className="space-y-2">
      {/* Classification modes */}
      <div className="flex flex-wrap gap-1.5">
        {CLASS_MODES.map((m) => {
          const isOn = activeClass === m.value;
          return (
            <button
              key={m.value}
              onClick={() => setParam("stateClass", isOn ? null : m.value)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                isOn
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Specific states multi-select */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground hover:text-foreground">
              <span>Specific states</span>
              {selected.size > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {selected.size}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-1">
            <div className="max-h-72 overflow-y-auto">
              {STATE_OPTIONS.map(({ abbrev, name }) => {
                const cls = stateClassifications[abbrev.toUpperCase()] ?? "unknown";
                const colors = getStateColor(cls);
                const isOn = selected.has(abbrev);
                return (
                  <button
                    key={abbrev}
                    onClick={() => toggleState(abbrev)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isOn ? "border-primary bg-primary text-primary-foreground" : "border-input"
                      }`}
                    >
                      {isOn && <Check className="h-3 w-3" />}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}
                    >
                      {abbrev}
                    </span>
                    <span className="truncate text-muted-foreground">{name}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* any / none operator — only meaningful when states are selected */}
        {selected.size > 0 && (
          <div className="flex overflow-hidden rounded-md border border-input text-xs">
            <button
              onClick={() => setMany({ statesOp: null })}
              className={`px-2 py-1.5 ${
                statesOp === "any" ? "bg-primary/10 text-primary" : "text-muted-foreground"
              }`}
            >
              Has any
            </button>
            <button
              onClick={() => setMany({ statesOp: "none" })}
              className={`px-2 py-1.5 ${
                statesOp === "none" ? "bg-primary/10 text-primary" : "text-muted-foreground"
              }`}
            >
              Excludes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
