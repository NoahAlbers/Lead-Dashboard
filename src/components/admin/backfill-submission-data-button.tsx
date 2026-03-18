"use client";

import { useTransition, useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { backfillSubmissionDataEvents } from "@/actions/lead.actions";
import { toast } from "@/components/ui/use-toast";

export function BackfillSubmissionDataButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ created: number } | null>(null);

  function handleClick() {
    startTransition(async () => {
      try {
        const res = await backfillSubmissionDataEvents();
        setResult(res);
        toast({
          title: "Backfill complete",
          description: `Created ${res.created} submission data events`,
          variant: "success",
        });
      } catch (err) {
        toast({
          title: "Backfill failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <div>
      <h2 className="font-semibold mb-2">Backfill Submission Data</h2>
      <p className="text-sm text-muted-foreground mb-3">
        Create submission data events for existing leads that were created before
        the timeline data capture was added. Processes up to 500 leads at a time.
      </p>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Database className="h-4 w-4" />
        )}
        {isPending ? "Backfilling..." : "Backfill Submission Data"}
      </button>
      {result && !isPending && (
        <p className="text-sm text-muted-foreground mt-2">
          Last run: {result.created} events created
        </p>
      )}
    </div>
  );
}
