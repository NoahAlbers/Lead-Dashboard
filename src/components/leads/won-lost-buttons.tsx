"use client";

import { useState, useTransition } from "react";
import { Trophy, XCircle } from "lucide-react";
import { updateLeadStatus } from "@/actions/lead.actions";
import { OutcomeModal } from "@/components/leads/outcome-modal";
import { toast } from "@/components/ui/use-toast";
import type { LeadStatus } from "@prisma/client";

interface WonLostButtonsProps {
  leadId: string;
  currentStatus: LeadStatus;
  referralPartners: Array<{ id: string; name: string }>;
}

export function WonLostButtons({ leadId, currentStatus, referralPartners }: WonLostButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [outcomeModal, setOutcomeModal] = useState<{ outcomeType: "won" | "lost"; targetStatus: LeadStatus } | null>(null);

  function confirmOutcome() {
    if (!outcomeModal) return;
    const targetStatus = outcomeModal.targetStatus;
    setOutcomeModal(null);
    startTransition(async () => {
      await updateLeadStatus(leadId, targetStatus);
      toast({ title: `Status changed to ${targetStatus.replace(/_/g, " ")}`, variant: "success" });
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOutcomeModal({ outcomeType: "won", targetStatus: "WON" as LeadStatus })}
          disabled={isPending || currentStatus === "WON"}
          className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          <Trophy className="h-4 w-4" />
          {currentStatus === "WON" ? "Won" : "Mark Won"}
        </button>
        <button
          onClick={() => setOutcomeModal({ outcomeType: "lost", targetStatus: "LOST" as LeadStatus })}
          disabled={isPending || currentStatus === "LOST"}
          className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          <XCircle className="h-4 w-4" />
          {currentStatus === "LOST" ? "Lost" : "Mark Lost"}
        </button>
      </div>

      {outcomeModal && (
        <OutcomeModal
          open={true}
          onClose={() => setOutcomeModal(null)}
          onConfirm={confirmOutcome}
          leadId={leadId}
          outcomeType={outcomeModal.outcomeType}
          referralPartners={referralPartners}
        />
      )}
    </>
  );
}
