interface AgingBadgeProps {
  createdAt: string | Date;
  thresholds?: { green: number; yellow: number; orange: number; red: number };
}

export function AgingBadge({ createdAt, thresholds }: AgingBadgeProps) {
  const t = thresholds ?? { green: 2, yellow: 4, orange: 6, red: 7 };
  const daysSince = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 86400000
  );

  let label: string;
  let className: string;

  if (daysSince === 0) {
    label = "Today";
    className = "bg-green-100 text-green-700";
  } else if (daysSince <= t.green) {
    label = `${daysSince}d`;
    className = "bg-green-100 text-green-700";
  } else if (daysSince <= t.yellow) {
    label = `${daysSince}d`;
    className = "bg-amber-100 text-amber-700";
  } else if (daysSince <= t.orange) {
    label = `${daysSince}d`;
    className = "bg-orange-100 text-orange-700";
  } else if (daysSince < t.red) {
    label = `${daysSince}d`;
    className = "bg-red-100 text-red-700";
  } else {
    label = `${daysSince}d`;
    className = "bg-red-200 text-red-800 font-bold";
  }

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
