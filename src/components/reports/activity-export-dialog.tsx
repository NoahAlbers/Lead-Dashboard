"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { exportActivityLog } from "@/actions/activity-export.actions";
import { getActiveUsers } from "@/actions/assignment.actions";
import { Download, Loader2 } from "lucide-react";

const EVENT_TYPE_OPTIONS = [
  { value: "status_changed", label: "Status Changed" },
  { value: "note_added", label: "Note Added" },
  { value: "email_action_opened", label: "Email Action Opened" },
  { value: "call_action_opened", label: "Call Action Opened" },
  { value: "assigned_user_changed", label: "Assigned User Changed" },
  { value: "score_calculated", label: "Score Calculated" },
  { value: "duplicate_flagged", label: "Duplicate Flagged" },
  { value: "crm_exported", label: "CRM Exported" },
  { value: "quick_log", label: "Quick Log" },
  { value: "lead_created", label: "Lead Created" },
] as const;

function formatDateForInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface ActivityExportDialogProps {
  open: boolean;
  onClose: () => void;
  userRole?: string;
}

export function ActivityExportDialog({
  open,
  onClose,
  userRole,
}: ActivityExportDialogProps) {
  const [isPending, startTransition] = useTransition();

  // Date range — default last 30 days
  const [dateTo, setDateTo] = useState(() => formatDateForInput(new Date()));
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDateForInput(d);
  });

  // Event types
  const [allEvents, setAllEvents] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  // Scope
  const isAdmin = userRole === "ADMIN" || userRole === "MANAGER";
  const [scope, setScope] = useState<"all" | "my_leads" | "user">(
    isAdmin ? "all" : "my_leads",
  );
  const [selectedUserId, setSelectedUserId] = useState("");

  // Users for dropdown
  const [users, setUsers] = useState<
    { id: string; name: string; role: string }[]
  >([]);

  useEffect(() => {
    if (open && isAdmin) {
      getActiveUsers().then((u) => setUsers(u));
    }
  }, [open, isAdmin]);

  function handleEventTypeToggle(value: string) {
    setSelectedTypes((prev) =>
      prev.includes(value)
        ? prev.filter((t) => t !== value)
        : [...prev, value],
    );
  }

  function handleExport() {
    startTransition(async () => {
      try {
        const csv = await exportActivityLog({
          dateFrom,
          dateTo,
          eventTypes: allEvents ? undefined : selectedTypes,
          scope,
          userId: scope === "user" ? selectedUserId : undefined,
        });

        // Create blob and trigger download
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `activity-log-${dateFrom}-to-${dateTo}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({ title: "Export complete", description: "CSV file downloaded." });
        onClose();
      } catch (err) {
        toast({
          title: "Export failed",
          description:
            err instanceof Error ? err.message : "An error occurred.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Activity Log</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Date Range</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Event Types */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Event Types</label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allEvents}
                onChange={(e) => setAllEvents(e.target.checked)}
                className="rounded border-input"
              />
              All events
            </label>
            {!allEvents && (
              <div className="grid grid-cols-2 gap-1 pl-2">
                {EVENT_TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(opt.value)}
                      onChange={() => handleEventTypeToggle(opt.value)}
                      className="rounded border-input"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Scope</label>
            <div className="space-y-1">
              {isAdmin && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="scope"
                    value="all"
                    checked={scope === "all"}
                    onChange={() => setScope("all")}
                  />
                  All leads
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scope"
                  value="my_leads"
                  checked={scope === "my_leads"}
                  onChange={() => setScope("my_leads")}
                />
                My assigned leads
              </label>
              {isAdmin && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="scope"
                    value="user"
                    checked={scope === "user"}
                    onChange={() => setScope("user")}
                  />
                  Specific user
                </label>
              )}
            </div>
            {scope === "user" && isAdmin && (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a user...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={
              isPending ||
              !dateFrom ||
              !dateTo ||
              (!allEvents && selectedTypes.length === 0) ||
              (scope === "user" && !selectedUserId)
            }
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isPending ? "Exporting..." : "Export CSV"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
