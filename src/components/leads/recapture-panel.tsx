"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailX } from "lucide-react";
import { stopRecaptureManually } from "@/actions/recapture.actions";
import { toast } from "@/components/ui/use-toast";

interface RecapturePanelProps {
  leadId: string;
  enrollment: {
    status: string;
    stopReason: string | null;
    currentStep: number;
    nextSendAt: string | null;
    lastSentAt: string | null;
    abandonedStep: string | null;
  };
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-amber-100 text-amber-700",
  converted: "bg-green-100 text-green-700",
  stopped: "bg-muted text-muted-foreground",
  exhausted: "bg-muted text-muted-foreground",
};

function fmt(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/New_York",
  }) + " EST";
}

export function RecapturePanel({ leadId, enrollment }: RecapturePanelProps) {
  const router = useRouter();
  const [stopping, setStopping] = useState(false);

  async function stop() {
    setStopping(true);
    try {
      await stopRecaptureManually(leadId);
      toast({ title: "Recapture emails stopped", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Failed to stop recapture", variant: "destructive" });
    } finally {
      setStopping(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
          Recapture Campaign
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[enrollment.status] ?? "bg-muted text-muted-foreground"}`}>
          {enrollment.status}
        </span>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Emails sent</span>
          <span className="font-medium">{enrollment.currentStep} of 3</span>
        </div>
        {enrollment.status === "active" && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Next email</span>
            <span className="font-medium">{fmt(enrollment.nextSendAt)}</span>
          </div>
        )}
        {enrollment.lastSentAt && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last sent</span>
            <span className="font-medium">{fmt(enrollment.lastSentAt)}</span>
          </div>
        )}
        {enrollment.abandonedStep && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Abandoned at</span>
            <span className="font-medium">{enrollment.abandonedStep.replace("abandoned_at_", "")}</span>
          </div>
        )}
        {enrollment.stopReason && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Reason</span>
            <span className="font-medium">{enrollment.stopReason.replace(/_/g, " ")}</span>
          </div>
        )}
      </div>
      {enrollment.status === "active" && (
        <button
          onClick={stop}
          disabled={stopping}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          <MailX className="h-3.5 w-3.5" />
          {stopping ? "Stopping..." : "Stop recapture emails"}
        </button>
      )}
    </div>
  );
}
