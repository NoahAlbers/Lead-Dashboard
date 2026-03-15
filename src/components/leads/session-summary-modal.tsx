"use client";

import { useRouter } from "next/navigation";
import { CheckCircle, Clock, XCircle, ArrowRight } from "lucide-react";
import { useWorkingMode } from "./working-mode-provider";

export function SessionSummaryModal() {
  const router = useRouter();
  const { isWorkingMode, dispositions, sessionStartTime, exitWorkingMode, queue } = useWorkingMode();

  // Only show when exiting (isWorkingMode just turned false but we have data)
  // Actually, we'll control this from the exit flow — show as inline component
  if (dispositions.length === 0) return null;

  const totalTime = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 60000) : 0;

  // Count by disposition type
  const breakdown: Record<string, number> = {};
  for (const d of dispositions) {
    breakdown[d.disposition] = (breakdown[d.disposition] ?? 0) + 1;
  }

  const LABELS: Record<string, { label: string; icon: typeof CheckCircle }> = {
    contacted_will_follow_up: { label: "Contacted — Will Follow Up", icon: CheckCircle },
    contacted_qualified: { label: "Contacted — Qualified", icon: CheckCircle },
    emailed_awaiting: { label: "Emailed", icon: ArrowRight },
    called_voicemail: { label: "Called — Voicemail", icon: Clock },
    called_spoke: { label: "Called — Spoke", icon: CheckCircle },
    needs_follow_up: { label: "Follow-Up Needed", icon: Clock },
    referred_out: { label: "Referred Out", icon: ArrowRight },
    not_a_fit: { label: "Disqualified", icon: XCircle },
    duplicate: { label: "Duplicate", icon: XCircle },
    note_only: { label: "Note Only", icon: ArrowRight },
  };

  function handleClose() {
    exitWorkingMode();
    router.push("/leads");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-bold mb-1">Session Complete</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {dispositions.length} lead{dispositions.length !== 1 ? "s" : ""} processed in {totalTime} minute{totalTime !== 1 ? "s" : ""}
        </p>

        <div className="space-y-2 mb-6">
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

        <button
          onClick={handleClose}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Return to Inbox
        </button>
      </div>
    </div>
  );
}
