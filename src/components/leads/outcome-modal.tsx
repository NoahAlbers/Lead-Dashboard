"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { createOutcome, getOutcomeReasonConfigs } from "@/actions/outcome.actions";
import { toast } from "@/components/ui/use-toast";

interface OutcomeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (result?: { referralPartnerId?: string }) => void;
  leadId: string;
  outcomeType: "won" | "lost" | "disqualified" | "referred_out";
  referralPartners?: Array<{ id: string; name: string }>;
}

const OUTCOME_TITLES: Record<string, string> = {
  won: "Record Win",
  lost: "Record Loss",
  disqualified: "Record Disqualification",
  referred_out: "Record Referral",
};

export function OutcomeModal({
  open,
  onClose,
  onConfirm,
  leadId,
  outcomeType,
  referralPartners = [],
}: OutcomeModalProps) {
  const [isPending, startTransition] = useTransition();
  const [reasons, setReasons] = useState<Array<{ id: string; reasonText: string }>>([]);

  // Form state
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [reasonDetail, setReasonDetail] = useState("");
  const [notes, setNotes] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [estimatedAnnualRevenue, setEstimatedAnnualRevenue] = useState("");
  const [accountVolume, setAccountVolume] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [couldHaveWon, setCouldHaveWon] = useState("");
  const [referralPartnerId, setReferralPartnerId] = useState("");

  useEffect(() => {
    if (open) {
      // Reset form
      setSelectedReasons([]);
      setReasonDetail("");
      setNotes("");
      setEstimatedValue("");
      setEstimatedAnnualRevenue("");
      setAccountVolume("");
      setCompetitor("");
      setCouldHaveWon("");
      setReferralPartnerId("");

      // Fetch reasons
      getOutcomeReasonConfigs(outcomeType).then((configs) => {
        setReasons(configs.map((c) => ({ id: c.id, reasonText: c.reasonText })));
      });
    }
  }, [open, outcomeType]);

  function toggleReason(text: string) {
    setSelectedReasons((prev) =>
      prev.includes(text) ? prev.filter((r) => r !== text) : [...prev, text]
    );
  }

  function handleSave() {
    if (selectedReasons.length === 0) {
      toast({ title: "Please select at least one reason", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      try {
        await createOutcome(leadId, {
          outcomeType,
          reason: selectedReasons[0],
          reasons: selectedReasons,
          reasonDetail: reasonDetail || undefined,
          notes: notes || undefined,
          competitor: competitor || undefined,
          couldHaveWon: couldHaveWon || undefined,
          estimatedValue: estimatedValue ? parseFloat(estimatedValue) : undefined,
          estimatedAnnualRevenue: estimatedAnnualRevenue ? parseFloat(estimatedAnnualRevenue) : undefined,
          accountVolume: accountVolume ? parseInt(accountVolume, 10) : undefined,
          referralPartnerId: referralPartnerId || undefined,
        });
        toast({ title: "Outcome recorded", variant: "success" });
        onConfirm({ referralPartnerId: referralPartnerId || undefined });
      } catch {
        toast({ title: "Failed to save outcome", variant: "destructive" });
      }
    });
  }

  const inputClass =
    "w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{OUTCOME_TITLES[outcomeType] ?? "Record Outcome"}</DialogTitle>
          <DialogDescription>
            Provide details about this outcome for reporting purposes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reasons (all types, multi-select) */}
          <div>
            <label className="text-sm font-medium mb-1 block">Reasons * <span className="text-muted-foreground font-normal">(select all that apply)</span></label>
            <div className="rounded-md border p-2 space-y-1 max-h-44 overflow-y-auto">
              {reasons.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedReasons.includes(r.reasonText)}
                    onChange={() => toggleReason(r.reasonText)}
                    className="h-4 w-4"
                  />
                  {r.reasonText}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedReasons.includes("Other")}
                  onChange={() => toggleReason("Other")}
                  className="h-4 w-4"
                />
                Other
              </label>
            </div>
          </div>

          {/* Reason Detail (when Other is selected or for extra context) */}
          {selectedReasons.includes("Other") && (
            <div>
              <label className="text-sm font-medium mb-1 block">Specify Reason</label>
              <input
                type="text"
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                placeholder="Enter specific reason..."
                className={inputClass}
              />
            </div>
          )}

          {/* Won-specific fields */}
          {outcomeType === "won" && (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">Estimated Contract Value ($)</label>
                <input
                  type="number"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Estimated Annual Revenue ($)</label>
                <input
                  type="number"
                  value={estimatedAnnualRevenue}
                  onChange={(e) => setEstimatedAnnualRevenue(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Account Volume</label>
                <input
                  type="number"
                  value={accountVolume}
                  onChange={(e) => setAccountVolume(e.target.value)}
                  placeholder="Number of accounts"
                  min="0"
                  className={inputClass}
                />
              </div>
            </>
          )}

          {/* Lost-specific fields */}
          {outcomeType === "lost" && (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">Competitor</label>
                <input
                  type="text"
                  value={competitor}
                  onChange={(e) => setCompetitor(e.target.value)}
                  placeholder="Who did they go with?"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Could We Have Won?</label>
                <div className="flex gap-4 mt-1">
                  {["yes", "maybe", "no"].map((opt) => (
                    <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="couldHaveWon"
                        value={opt}
                        checked={couldHaveWon === opt}
                        onChange={() => setCouldHaveWon(opt)}
                        className="accent-primary"
                      />
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Referred Out-specific fields */}
          {outcomeType === "referred_out" && (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">Referral Partner</label>
                <select
                  value={referralPartnerId}
                  onChange={(e) => setReferralPartnerId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a partner...</option>
                  {referralPartners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Estimated Value Being Referred ($)</label>
                <input
                  type="number"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className={inputClass}
                />
              </div>
            </>
          )}

          {/* Notes (all types) */}
          <div>
            <label className="text-sm font-medium mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional context..."
              rows={3}
              className={inputClass + " min-h-[70px]"}
            />
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || selectedReasons.length === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Saving..." : "Save & Continue"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
