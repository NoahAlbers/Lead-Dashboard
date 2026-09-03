"use client";

// Write down a call or an email that already happened. Kept deliberately
// short: what happened, and anything worth remembering. The note can be left
// empty and filled in later from the timeline, which is what usually happens
// when somebody dials, talks, and types afterwards.

import { useState, useTransition } from "react";
import { Phone, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import {
  logInteraction,
  CALL_OUTCOMES,
  EMAIL_OUTCOMES,
  type InteractionKind,
} from "@/actions/interaction.actions";

interface LogInteractionDialogProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
  kind: InteractionKind;
  /** Shown in the title so it is obvious who this is about. */
  leadLabel?: string | null;
}

export function LogInteractionDialog({ open, onClose, leadId, kind, leadLabel }: LogInteractionDialogProps) {
  const outcomes = kind === "call" ? CALL_OUTCOMES : EMAIL_OUTCOMES;
  const [outcome, setOutcome] = useState<string>(outcomes[0].value);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await logInteraction(leadId, { kind, outcome, note });
      if (!res.success) {
        toast({ title: "Not logged", description: res.error, variant: "destructive" });
        return;
      }
      toast({
        title: kind === "call" ? "Call logged" : "Email logged",
        description: note.trim() ? undefined : "You can add notes to it later from the timeline.",
        variant: "success",
      });
      setNote("");
      setOutcome(outcomes[0].value);
      onClose();
    });
  }

  const Icon = kind === "call" ? Phone : Mail;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isPending) onClose(); }}>
      <DialogContent closeDisabled={isPending}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${kind === "call" ? "text-green-600" : "text-blue-500"}`} />
            Log a {kind === "call" ? "call" : "email"}
            {leadLabel ? ` with ${leadLabel}` : ""}
          </DialogTitle>
          <DialogDescription>
            For something that already happened outside the console.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">What happened</p>
            <div className="flex flex-wrap gap-1.5">
              {outcomes.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOutcome(o.value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    outcome === o.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm">
            <span className="text-xs font-medium text-muted-foreground">Notes</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="What was said, what they need, anything to remember. You can leave this and come back to it."
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Log it"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
