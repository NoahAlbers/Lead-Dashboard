"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

const ranges = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "All Time", value: "all" },
] as const;

export type TimeRange = (typeof ranges)[number]["value"];

export function TimeRangeSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = (searchParams.get("range") as TimeRange) || "30d";

  const handleSelect = useCallback(
    (value: TimeRange) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("range", value);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
      {ranges.map((r) => (
        <button
          key={r.value}
          onClick={() => handleSelect(r.value)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            current === r.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
