import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, className }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </div>
    </div>
  );
}
