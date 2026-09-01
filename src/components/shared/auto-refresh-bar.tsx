"use client";

import { useState, useEffect } from "react";
import { RotateCw } from "lucide-react";
import { useAutoRefresh } from "./auto-refresh-provider";

const INTERVAL_OPTIONS = [
  { label: "15s", value: 15000 },
  { label: "30s", value: 30000 },
  { label: "60s", value: 60000 },
  { label: "2m", value: 120000 },
  { label: "Off", value: 0 },
] as const;

function formatTimeAgo(date: Date): string {
  const diff = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

interface AutoRefreshBarProps {
  variant?: "inbox" | "reports";
}

export function AutoRefreshBar({ variant = "inbox" }: AutoRefreshBarProps) {
  const {
    lastRefreshAt,
    intervalMs,
    setIntervalMs,
    manualRefresh,
    newLeadCount,
    clearNewLeads,
    isPaused,
    isRefreshing,
  } = useAutoRefresh();

  const [timeAgo, setTimeAgo] = useState(() => formatTimeAgo(lastRefreshAt));

  // Update the "X ago" label every second
  useEffect(() => {
    const id = setInterval(() => {
      setTimeAgo(formatTimeAgo(lastRefreshAt));
    }, 1000);
    // Also update immediately when lastRefreshAt changes
    setTimeAgo(formatTimeAgo(lastRefreshAt));
    return () => clearInterval(id);
  }, [lastRefreshAt]);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {/* Left: Updated X ago */}
      <span className="whitespace-nowrap">
        Updated {timeAgo}
        {isPaused && (
          <span className="ml-1 text-yellow-600 dark:text-yellow-400">
            (paused)
          </span>
        )}
      </span>

      {/* Center: new leads banner (inbox only) */}
      {variant === "inbox" && newLeadCount > 0 && (
        <button
          onClick={() => {
            manualRefresh();
            clearNewLeads();
          }}
          className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          {newLeadCount} new lead{newLeadCount > 1 ? "s" : ""}
        </button>
      )}

      {/* Right: manual refresh */}
      <button
        onClick={manualRefresh}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted transition-colors"
        title="Refresh now"
      >
        <RotateCw
          className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`}
        />
        <span className="hidden sm:inline">Refresh</span>
      </button>

      {/* Right: interval selector */}
      <select
        value={intervalMs}
        onChange={(e) => setIntervalMs(Number(e.target.value))}
        className="h-6 rounded border border-input bg-background px-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        title="Auto-refresh interval"
      >
        {INTERVAL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
