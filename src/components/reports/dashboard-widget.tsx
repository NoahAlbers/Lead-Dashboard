"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

interface DashboardWidgetProps {
  title: string;
  subtitle?: string;
  span?: 1 | 2;
  height?: number;
  children: React.ReactNode;
  widgetId?: string;
  onHide?: () => void;
}

export function DashboardWidget({
  title,
  subtitle,
  span = 1,
  height,
  children,
  onHide,
}: DashboardWidgetProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className={`rounded-lg border bg-card ${span === 2 ? "lg:col-span-2" : ""}`}>
      <div className="flex items-start justify-between p-4 pb-0">
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {onHide && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="rounded p-1 hover:bg-muted text-muted-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 rounded-md border bg-card shadow-lg py-1 z-10 min-w-[140px]">
                <button
                  onClick={() => { onHide(); setShowMenu(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                >
                  Hide widget
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="p-4" style={height ? { height } : undefined}>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[120px] text-sm text-muted-foreground">
      {message ?? "No data for this period"}
    </div>
  );
}
