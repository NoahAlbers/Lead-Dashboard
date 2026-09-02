"use client";

import { useRouter } from "next/navigation";
import { CheckCircle, Clock, XCircle, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useWorkingMode } from "./working-mode-provider";

const LABELS: Record<string, { label: string; icon: typeof CheckCircle }> = {
  contacted_will_follow_up: { label: "Contacted, will follow up", icon: CheckCircle },
  contacted_qualified: { label: "Contacted, qualified", icon: CheckCircle },
  emailed_awaiting: { label: "Emailed", icon: ArrowRight },
  called_voicemail: { label: "Called, voicemail", icon: Clock },
  called_spoke: { label: "Called, spoke", icon: CheckCircle },
  needs_follow_up: { label: "Follow-up needed", icon: Clock },
  referred_out: { label: "Referred out", icon: ArrowRight },
  not_a_fit: { label: "Disqualified", icon: XCircle },
  duplicate: { label: "Duplicate", icon: XCircle },
  note_only: { label: "Note only", icon: ArrowRight },
};

export function SessionSummaryModal() {
  const router = useRouter();
  const { dispositions, sessionStartTime, exitWorkingMode } = useWorkingMode();

  // Shown once the session has produced dispositions; the exit flow mounts this component.
  const open = dispositions.length > 0;

  const totalTime = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 60000) : 0;

  // Count by disposition type
  const breakdown: Record<string, number> = {};
  for (const d of dispositions) {
    breakdown[d.disposition] = (breakdown[d.disposition] ?? 0) + 1;
  }

  function handleClose() {
    exitWorkingMode();
    router.push("/leads");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="font-bold">Session complete</DialogTitle>
          <DialogDescription>
            {dispositions.length} lead{dispositions.length !== 1 ? "s" : ""} processed in {totalTime} minute{totalTime !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {Object.entries(breakdown).map(([type, count]) => {
            const info = LABELS[type] ?? { label: type, icon: ArrowRight };
            const Icon = info.icon;
            return (
              <div key={type} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{info.label}</span>
                </div>
                <span className="font-semibold">{count}</span>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Return to inbox
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
