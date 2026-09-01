import { estCalendarDaysSince, relativeDayLabel } from "@/lib/timezone";

interface AgingBadgeProps {
  createdAt: string | Date;
  thresholds?: { green: number; yellow: number; orange: number; red: number };
}

/** Age by Eastern calendar day: Today, Yesterday, then Nd with aging colors. */
export function AgingBadge({ createdAt, thresholds }: AgingBadgeProps) {
  const t = thresholds ?? { green: 2, yellow: 4, orange: 6, red: 7 };
  const daysSince = estCalendarDaysSince(createdAt);
  const label = relativeDayLabel(createdAt);

  let className: string;
  if (daysSince <= t.green) {
    className = "bg-green-100 text-green-700";
  } else if (daysSince <= t.yellow) {
    className = "bg-amber-100 text-amber-700";
  } else if (daysSince <= t.orange) {
    className = "bg-orange-100 text-orange-700";
  } else if (daysSince < t.red) {
    className = "bg-red-100 text-red-700";
  } else {
    className = "bg-red-200 text-red-800 font-bold";
  }

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}
