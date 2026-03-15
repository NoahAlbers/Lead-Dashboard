"use client";

import { useState, useEffect, useTransition } from "react";
import { UserPlus, X, CheckCircle } from "lucide-react";
import { bulkAssignLeads, bulkUpdateStatus, bulkMarkAsRead } from "@/actions/lead.actions";
import { getActiveUsers } from "@/actions/assignment.actions";
import { toast } from "@/components/ui/use-toast";
import type { LeadStatus } from "@prisma/client";

interface BulkActionBarProps {
  selectedIds: Set<string>;
  onClear: () => void;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

const BULK_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "FOLLOW_UP_NEEDED", label: "Follow-Up" },
  { value: "DISQUALIFIED", label: "Disqualified" },
  { value: "ARCHIVED", label: "Archived" },
];

export function BulkActionBar({ selectedIds, onClear }: BulkActionBarProps) {
  const [isPending, startTransition] = useTransition();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    if (showAssign && users.length === 0) {
      getActiveUsers().then(setUsers);
    }
  }, [showAssign, users.length]);

  const count = selectedIds.size;
  if (count === 0) return null;

  function handleAssign(userId: string) {
    startTransition(async () => {
      await bulkAssignLeads(Array.from(selectedIds), userId);
      const userName = users.find((u) => u.id === userId)?.name ?? "user";
      toast({ title: `${count} lead${count !== 1 ? "s" : ""} assigned to ${userName}`, variant: "success" });
      setShowAssign(false);
      onClear();
    });
  }

  function handleStatus(status: LeadStatus) {
    startTransition(async () => {
      await bulkUpdateStatus(Array.from(selectedIds), status);
      toast({ title: `${count} lead${count !== 1 ? "s" : ""} updated`, variant: "success" });
      setShowStatus(false);
      onClear();
    });
  }

  function handleMarkRead() {
    startTransition(async () => {
      await bulkMarkAsRead(Array.from(selectedIds));
      toast({ title: `${count} lead${count !== 1 ? "s" : ""} marked as read`, variant: "success" });
      onClear();
    });
  }

  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 mb-4">
      <span className="text-sm font-medium text-primary">{count} selected</span>

      <div className="relative">
        <button
          onClick={() => { setShowAssign(!showAssign); setShowStatus(false); }}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-md bg-card border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Assign to...
        </button>
        {showAssign && (
          <div className="absolute left-0 top-full mt-1 w-52 rounded-lg border bg-card shadow-lg z-50 py-1 max-h-[200px] overflow-y-auto">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleAssign(user.id)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted text-left"
              >
                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                  {user.name.charAt(0)}
                </span>
                {user.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => { setShowStatus(!showStatus); setShowAssign(false); }}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-md bg-card border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Change Status
        </button>
        {showStatus && (
          <div className="absolute left-0 top-full mt-1 w-44 rounded-lg border bg-card shadow-lg z-50 py-1">
            {BULK_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatus(opt.value)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleMarkRead}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-md bg-card border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
      >
        Mark as Read
      </button>

      <button
        onClick={onClear}
        className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        <X className="h-3.5 w-3.5" />
        Clear
      </button>
    </div>
  );
}
