"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { UserPlus, Check } from "lucide-react";
import { assignLead } from "@/actions/lead.actions";
import { getActiveUsers } from "@/actions/assignment.actions";
import { toast } from "@/components/ui/use-toast";

interface AssignDropdownProps {
  leadId: string;
  currentAssigneeId?: string | null;
  leadLabel?: string;
  compact?: boolean;
  onAssigned?: () => void;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

export function AssignDropdown({ leadId, currentAssigneeId, leadLabel, compact, onAssigned }: AssignDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && users.length === 0) {
      getActiveUsers().then(setUsers);
    }
  }, [isOpen, users.length]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    if (isOpen) { document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler); }
  }, [isOpen]);

  function handleAssign(e: React.MouseEvent, userId: string | null) {
    e.stopPropagation();
    startTransition(async () => {
      await assignLead(leadId, userId);
      const userName = users.find((u) => u.id === userId)?.name ?? "Unassigned";
      toast({ title: `${leadLabel ?? "Lead"} assigned to ${userName}`, variant: "success" });
      setIsOpen(false);
      onAssigned?.();
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        disabled={isPending}
        className={compact
          ? "action-btn relative rounded p-1 transition-all disabled:opacity-30 hover:bg-indigo-50 text-indigo-500"
          : "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        }
        data-tooltip="Assign"
      >
        <UserPlus className={compact ? "h-4 w-4" : "h-3.5 w-3.5"} />
        {!compact && "Assign"}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border bg-card shadow-lg z-50 py-1 max-h-[250px] overflow-y-auto">
          <button
            onClick={(e) => handleAssign(e, null)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted text-left text-muted-foreground italic"
          >
            Unassign
            {!currentAssigneeId && <Check className="h-3 w-3 ml-auto text-primary" />}
          </button>
          <div className="border-t my-1" />
          {users.map((user) => (
            <button
              key={user.id}
              onClick={(e) => handleAssign(e, user.id)}
              disabled={isPending}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted text-left"
            >
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="flex-1 truncate">{user.name}</span>
              <span className="text-[10px] text-muted-foreground">{user.role}</span>
              {currentAssigneeId === user.id && <Check className="h-3 w-3 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
