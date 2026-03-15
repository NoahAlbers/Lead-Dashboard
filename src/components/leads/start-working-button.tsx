"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Play } from "lucide-react";
import { useWorkingMode } from "./working-mode-provider";
import { getWorkingQueue } from "@/actions/working-mode.actions";

export function StartWorkingButton() {
  const router = useRouter();
  const { enterWorkingMode } = useWorkingMode();
  const [isPending, startTransition] = useTransition();

  function handleStart() {
    startTransition(async () => {
      const queue = await getWorkingQueue({ sortField: "createdAt", sortDirection: "desc" });
      if (queue.length === 0) return;
      enterWorkingMode(queue);
      router.push(`/leads/${queue[0]}?workingMode=true`);
    });
  }

  return (
    <button
      onClick={handleStart}
      disabled={isPending}
      className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
    >
      <Play className="h-3.5 w-3.5" />
      {isPending ? "Loading..." : "Start Working Leads"}
    </button>
  );
}
