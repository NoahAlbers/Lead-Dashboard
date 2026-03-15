import { cn } from "@/lib/utils";
import type { LeadStatus } from "@prisma/client";

const statusColors: Record<LeadStatus, string> = {
  NEW: "bg-blue-100 text-blue-700",
  REVIEWED: "bg-purple-100 text-purple-700",
  QUALIFIED: "bg-green-100 text-green-700",
  CONTACTED: "bg-teal-100 text-teal-700",
  FOLLOW_UP_NEEDED: "bg-amber-100 text-amber-700",
  REFERRED_OUT: "bg-orange-100 text-orange-700",
  IMPORTED_TO_CRM: "bg-indigo-100 text-indigo-700",
  WON: "bg-emerald-100 text-emerald-700",
  LOST: "bg-red-100 text-red-700",
  DISQUALIFIED: "bg-gray-100 text-gray-700",
  DUPLICATE: "bg-yellow-100 text-yellow-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
  MERGED: "bg-gray-200 text-gray-600",
};

const statusLabels: Record<LeadStatus, string> = {
  NEW: "New",
  REVIEWED: "Reviewed",
  QUALIFIED: "Qualified",
  CONTACTED: "Contacted",
  FOLLOW_UP_NEEDED: "Follow-Up",
  REFERRED_OUT: "Referred",
  IMPORTED_TO_CRM: "In CRM",
  WON: "Won",
  LOST: "Lost",
  DISQUALIFIED: "Disqualified",
  DUPLICATE: "Duplicate",
  ARCHIVED: "Archived",
  MERGED: "Merged",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        statusColors[status]
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

const tierColors: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-amber-100 text-amber-700",
  POOR: "bg-red-100 text-red-700",
};

function getContrastTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1A1A2E" : "#ffffff";
}

export function TierBadge({ tier, colorMap }: { tier: string | null; colorMap?: Record<string, string> }) {
  if (!tier) return <span className="text-xs text-muted-foreground">—</span>;

  // Use DB-configured hex color with solid background + contrast text
  const hexColor = colorMap?.[tier];
  if (hexColor) {
    const textColor = getContrastTextColor(hexColor);
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
        style={{ backgroundColor: hexColor, color: textColor }}
      >
        {tier}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tierColors[tier] ?? "bg-purple-100 text-purple-700"
      )}
    >
      {tier}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;

  let color = "text-red-600";
  if (score >= 80) color = "text-emerald-600";
  else if (score >= 60) color = "text-blue-600";
  else if (score >= 40) color = "text-amber-600";

  return <span className={cn("text-sm font-semibold", color)}>{score}</span>;
}
