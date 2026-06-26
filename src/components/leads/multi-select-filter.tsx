"use client";

import { ChevronDown, Check } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useFilterParams } from "./use-filter-params";

export interface Option {
  value: string;
  label: string;
}

/**
 * Generic checkbox multi-select bound to a single comma-joined URL param.
 * Used for status / tier / SLA / assignee.
 */
export function MultiSelectFilter({
  label,
  paramKey,
  options,
}: {
  label: string;
  paramKey: string;
  options: Option[];
}) {
  const { searchParams, setParam } = useFilterParams();
  const selected = new Set(
    (searchParams.get(paramKey) ?? "").split(",").filter(Boolean)
  );

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setParam(paramKey, next.size ? Array.from(next).join(",") : null);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground hover:text-foreground">
          <span>{label}</span>
          {selected.size > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {selected.size}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="max-h-72 overflow-y-auto">
          {options.map((opt) => {
            const isOn = selected.has(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    isOn ? "border-primary bg-primary text-primary-foreground" : "border-input"
                  }`}
                >
                  {isOn && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
