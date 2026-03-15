"use client";

interface SlaBadgeProps {
  slaStatus: string | null;
  remainingMinutes?: number;
  compact?: boolean;
}

function formatTime(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 60) return `${abs}m`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  on_track: { bg: "bg-green-100", text: "text-green-700", label: "On Track" },
  warning: { bg: "bg-amber-100", text: "text-amber-700", label: "At Risk" },
  breached: { bg: "bg-red-100", text: "text-red-700", label: "Breached" },
  escalated: { bg: "bg-red-200", text: "text-red-800", label: "Escalated" },
  paused: { bg: "bg-muted", text: "text-muted-foreground", label: "N/A" },
};

export function SlaBadge({ slaStatus, remainingMinutes, compact }: SlaBadgeProps) {
  if (!slaStatus || slaStatus === "paused") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const config = STATUS_CONFIG[slaStatus] ?? STATUS_CONFIG.paused;
  const isOverdue = remainingMinutes != null && remainingMinutes < 0;
  const timeLabel = remainingMinutes != null
    ? (isOverdue ? `${formatTime(remainingMinutes)} over` : `${formatTime(remainingMinutes)} left`)
    : config.label;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.bg} ${config.text} ${
        slaStatus === "escalated" ? "animate-pulse" : ""
      }`}
    >
      {!compact && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {timeLabel}
    </span>
  );
}

interface SlaProgressBarProps {
  percentElapsed: number;
  slaStatus: string;
}

export function SlaProgressBar({ percentElapsed, slaStatus }: SlaProgressBarProps) {
  const clamped = Math.min(percentElapsed, 100);
  const barColor =
    slaStatus === "on_track" ? "bg-green-500" :
    slaStatus === "warning" ? "bg-amber-500" :
    slaStatus === "breached" || slaStatus === "escalated" ? "bg-red-500" :
    "bg-muted-foreground";

  return (
    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${barColor}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
