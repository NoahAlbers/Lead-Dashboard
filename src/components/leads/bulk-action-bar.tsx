"use client";

import { useState, useEffect, useTransition } from "react";
import { UserPlus, X, CheckCircle, Download, Archive, StickyNote, ChevronDown } from "lucide-react";
import { bulkAssignLeads, bulkUpdateStatus, bulkMarkAsRead, bulkArchiveLeads } from "@/actions/lead.actions";
import { bulkAddNote } from "@/actions/note.actions";
import { exportLeadsCsv } from "@/actions/export.actions";
import { getActiveUsers } from "@/actions/assignment.actions";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { LeadStatus } from "@prisma/client";

interface BulkActionBarProps {
  selectedIds: Set<string>;
  onClear: () => void;
  userRole?: string;
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

export function BulkActionBar({ selectedIds, onClear, userRole }: BulkActionBarProps) {
  const [isPending, startTransition] = useTransition();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    if (showAssign && users.length === 0) {
      getActiveUsers().then(setUsers);
    }
  }, [showAssign, users.length]);

  const count = selectedIds.size;
  if (count === 0) return null;

  const isManager = userRole === "ADMIN" || userRole === "MANAGER";

  function closeAllDropdowns() {
    setShowAssign(false);
    setShowStatus(false);
    setShowExport(false);
  }

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

  function handleExportCsv() {
    startTransition(async () => {
      try {
        const csv = await exportLeadsCsv(Array.from(selectedIds));
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({ title: `Exported ${count} lead${count !== 1 ? "s" : ""} to CSV`, variant: "success" });
      } catch (err) {
        toast({ title: "Export failed", variant: "destructive" });
      }
      setShowExport(false);
    });
  }

  function handleArchive() {
    startTransition(async () => {
      try {
        await bulkArchiveLeads(Array.from(selectedIds));
        toast({ title: `${count} lead${count !== 1 ? "s" : ""} archived`, variant: "success" });
        onClear();
      } catch (err) {
        toast({ title: "Archive failed", variant: "destructive" });
      }
      setShowArchiveConfirm(false);
    });
  }

  function handleSaveNote() {
    if (!noteText.trim()) return;
    startTransition(async () => {
      try {
        await bulkAddNote(Array.from(selectedIds), noteText.trim());
        toast({ title: `Note added to ${count} lead${count !== 1 ? "s" : ""}`, variant: "success" });
        setNoteText("");
        setShowNoteInput(false);
        onClear();
      } catch (err) {
        toast({ title: "Failed to add note", variant: "destructive" });
      }
    });
  }

  return (
    <>
      <div className="sticky top-0 z-20 rounded-lg border border-primary/30 bg-primary/5 mb-4">
        <div className="flex items-center gap-3 p-3 flex-wrap">
          <span className="text-sm font-medium text-primary">{count} selected</span>

          {/* Assign */}
          <div className="relative">
            <button
              onClick={() => { closeAllDropdowns(); setShowAssign(!showAssign); }}
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

          {/* Change Status */}
          <div className="relative">
            <button
              onClick={() => { closeAllDropdowns(); setShowStatus(!showStatus); }}
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

          {/* Mark as Read */}
          <button
            onClick={handleMarkRead}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-md bg-card border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            Mark as Read
          </button>

          {/* Export */}
          <div className="relative">
            <button
              onClick={() => { closeAllDropdowns(); setShowExport(!showExport); }}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md bg-card border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export
              <ChevronDown className="h-3 w-3" />
            </button>
            {showExport && (
              <div className="absolute left-0 top-full mt-1 w-48 rounded-lg border bg-card shadow-lg z-50 py-1">
                <button
                  onClick={handleExportCsv}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                >
                  Export CSV
                </button>
                <button
                  onClick={handleExportCsv}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                >
                  Export for CRM
                </button>
              </div>
            )}
          </div>

          {/* Archive (Manager/Admin only) */}
          {isManager && (
            <button
              onClick={() => setShowArchiveConfirm(true)}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md bg-card border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50 text-orange-600"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </button>
          )}

          {/* Add Note */}
          <button
            onClick={() => setShowNoteInput(!showNoteInput)}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-md bg-card border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <StickyNote className="h-3.5 w-3.5" />
            Add Note
          </button>

          {/* Clear */}
          <button
            onClick={onClear}
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>

        {/* Note Input Area */}
        {showNoteInput && (
          <div className="border-t border-primary/20 p-3 flex items-start gap-3">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={`Add a note to ${count} lead${count !== 1 ? "s" : ""}...`}
              className="flex-1 rounded-md border bg-card px-3 py-2 text-sm resize-none min-h-[60px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              rows={2}
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSaveNote}
                disabled={isPending || !noteText.trim()}
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Save Note
              </button>
              <button
                onClick={() => { setShowNoteInput(false); setNoteText(""); }}
                className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        open={showArchiveConfirm}
        title="Archive Leads"
        message={`Archive ${count} lead${count !== 1 ? "s" : ""}? This can be undone by an admin.`}
        confirmLabel="Archive"
        destructive
        onConfirm={handleArchive}
        onCancel={() => setShowArchiveConfirm(false)}
      />
    </>
  );
}
