"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X, SkipForward } from "lucide-react";
import { useWorkingMode } from "./working-mode-provider";

export function WorkingModeBar() {
  const router = useRouter();
  const { isWorkingMode, queue, currentIndex, exitWorkingMode, goToNext, goToPrevious, skip, dispositions } = useWorkingMode();

  if (!isWorkingMode) return null;

  const total = queue.length;
  const processed = dispositions.length;
  const progress = total > 0 ? (processed / total) * 100 : 0;

  function handlePrevious() {
    const prevId = goToPrevious();
    if (prevId) router.push(`/leads/${prevId}?workingMode=true`);
  }

  function handleSkip() {
    const nextId = skip();
    if (nextId) {
      router.push(`/leads/${nextId}?workingMode=true`);
    } else {
      handleExit();
    }
  }

  function handleExit() {
    exitWorkingMode();
    router.push("/leads");
  }

  return (
    <div className="sticky top-0 z-30 flex items-center gap-4 rounded-lg border-b bg-background px-4 py-2 mb-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-primary">Working Leads</span>
        <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold">
          {currentIndex + 1} of {total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{processed} processed</span>

      {/* Navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={handlePrevious}
          disabled={currentIndex <= 0}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors"
          title="Previous lead"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={handleSkip}
          disabled={currentIndex >= total - 1}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors"
          title="Skip to next"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      <button
        onClick={handleExit}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
        Exit
      </button>
    </div>
  );
}
