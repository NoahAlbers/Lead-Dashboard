"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle, Mail, Phone, PhoneOff, Clock, ArrowRight,
  XCircle, Copy, FileText, ChevronRight,
} from "lucide-react";
import { recordDisposition, type DispositionType } from "@/actions/working-mode.actions";
import { useWorkingMode } from "./working-mode-provider";
import { toast } from "@/components/ui/use-toast";

interface DispositionPanelProps {
  leadId: string;
  leadLabel: string;
}

const DISPOSITIONS: { type: DispositionType; label: string; icon: typeof CheckCircle; color: string }[] = [
  { type: "contacted_will_follow_up", label: "Contacted — Will Follow Up", icon: CheckCircle, color: "text-green-600 hover:bg-green-50" },
  { type: "contacted_qualified", label: "Contacted — Qualified", icon: CheckCircle, color: "text-emerald-600 hover:bg-emerald-50" },
  { type: "emailed_awaiting", label: "Emailed — Awaiting Response", icon: Mail, color: "text-blue-600 hover:bg-blue-50" },
  { type: "called_voicemail", label: "Called — Left Voicemail", icon: PhoneOff, color: "text-sky-600 hover:bg-sky-50" },
  { type: "called_spoke", label: "Called — Spoke with Contact", icon: Phone, color: "text-teal-600 hover:bg-teal-50" },
  { type: "needs_follow_up", label: "Needs Follow-Up", icon: Clock, color: "text-amber-600 hover:bg-amber-50" },
  { type: "referred_out", label: "Referred Out", icon: ArrowRight, color: "text-orange-600 hover:bg-orange-50" },
  { type: "not_a_fit", label: "Not a Fit — Disqualify", icon: XCircle, color: "text-red-600 hover:bg-red-50" },
  { type: "duplicate", label: "Duplicate", icon: Copy, color: "text-yellow-600 hover:bg-yellow-50" },
  { type: "note_only", label: "Add Note Only", icon: FileText, color: "text-muted-foreground hover:bg-muted" },
];

export function DispositionPanel({ leadId, leadLabel }: DispositionPanelProps) {
  const router = useRouter();
  const { isWorkingMode, goToNext, queue, currentIndex, recordDispositionInSession } = useWorkingMode();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [completed, setCompleted] = useState<{ disposition: string; newStatus: string | null } | null>(null);

  // Default follow-up: next business day at 9 AM
  function getDefaultFollowUp(): string {
    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    // Skip weekends
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }
    next.setHours(9, 0, 0, 0);
    return next.toISOString().slice(0, 16);
  }

  function handleDisposition(type: DispositionType) {
    const needsFollowUp = type === "needs_follow_up" || type === "contacted_will_follow_up";
    if (needsFollowUp && !followUpAt) {
      setShowFollowUp(true);
      setFollowUpAt(getDefaultFollowUp());
      return;
    }

    startTransition(async () => {
      const result = await recordDisposition(leadId, type, note || undefined, followUpAt || undefined);
      recordDispositionInSession(leadId, type);

      const label = DISPOSITIONS.find((d) => d.type === type)?.label ?? type;
      toast({ title: `${leadLabel}: ${label}`, variant: "success" });

      setCompleted({ disposition: label, newStatus: result.newStatus });
      setNote("");
      setFollowUpAt("");
      setShowFollowUp(false);
    });
  }

  function handleNext() {
    const nextId = goToNext();
    if (nextId) {
      setCompleted(null);
      router.push(`/leads/${nextId}?workingMode=true`);
    } else {
      router.push("/leads");
    }
  }

  function handleStay() {
    setCompleted(null);
  }

  // Post-disposition confirmation
  if (completed) {
    const isLast = currentIndex >= queue.length - 1;
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 mt-6">
        <p className="text-sm font-medium text-green-800">
          Marked as {completed.disposition}.
          {isLast ? " This was the last lead in the queue." : " Move to next lead?"}
        </p>
        <div className="flex gap-2 mt-3">
          {!isLast && (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Next Lead <ChevronRight className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={handleStay}
            className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Stay on This Lead
          </button>
          {isLast && (
            <button
              onClick={() => router.push("/leads")}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Return to Inbox
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 mt-6">
      <h3 className="font-semibold text-sm mb-3">What happened with this lead?</h3>

      {/* Follow-up date picker */}
      {showFollowUp && (
        <div className="mb-3 p-3 rounded-md bg-muted/50 border">
          <label className="text-sm font-medium">Schedule follow-up for:</label>
          <input
            type="datetime-local"
            value={followUpAt}
            onChange={(e) => setFollowUpAt(e.target.value)}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
          />
        </div>
      )}

      {/* Quick note */}
      <div className="mb-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Quick note (optional)..."
          className="w-full rounded-md border border-input bg-card p-2 text-sm min-h-[50px] resize-none"
        />
      </div>

      {/* Disposition buttons */}
      <div className="grid grid-cols-2 gap-2">
        {DISPOSITIONS.map((d) => (
          <button
            key={d.type}
            onClick={() => handleDisposition(d.type)}
            disabled={isPending}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${d.color}`}
          >
            <d.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{d.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
