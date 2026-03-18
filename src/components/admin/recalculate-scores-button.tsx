"use client";

import { useTransition, useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { recalculateAllScores } from "@/actions/lead.actions";
import { toast } from "@/components/ui/use-toast";

export function RecalculateScoresButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ scored: number; failed: number; total: number } | null>(null);

  function handleClick() {
    startTransition(async () => {
      try {
        const res = await recalculateAllScores();
        setResult(res);
        toast({
          title: "Score recalculation complete",
          description: `Scored ${res.scored} leads${res.failed > 0 ? ` (${res.failed} failed)` : ""}`,
          variant: res.failed > 0 ? "destructive" : "success",
        });
      } catch (err) {
        toast({
          title: "Recalculation failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <div>
      <h2 className="font-semibold mb-2">Recalculate Lead Scores</h2>
      <p className="text-sm text-muted-foreground mb-3">
        Re-run the scoring engine on all active leads. This will update scores,
        quality tiers, and recommended actions based on current rules.
      </p>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {isPending ? "Recalculating..." : "Recalculate All Scores"}
      </button>
      {result && !isPending && (
        <p className="text-sm text-muted-foreground mt-2">
          Last run: {result.scored}/{result.total} scored
          {result.failed > 0 && `, ${result.failed} failed`}
        </p>
      )}
    </div>
  );
}
