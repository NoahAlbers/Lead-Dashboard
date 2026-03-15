"use client";

import { GripVertical, MoreHorizontal } from "lucide-react";
import { useState } from "react";

interface DashboardWidgetProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onHide?: () => void;
}

export function DashboardWidget({
  title,
  subtitle,
  children,
  onHide,
}: DashboardWidgetProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="rounded-lg border bg-card h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-0">
        <div className="flex items-center gap-2">
          <div className="widget-drag-handle cursor-grab text-muted-foreground/40 hover:text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
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
      <div className="p-4 flex-1 min-h-0 overflow-auto">
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
