"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Star, Users, Pin } from "lucide-react";
import { togglePinView } from "@/actions/saved-view.actions";
import { buildViewParams, isViewActive } from "@/lib/apply-saved-view";
import { toast } from "@/components/ui/use-toast";

interface PinnedView {
  id: string;
  name: string;
  filtersJson: Record<string, string> | null;
  sortJson: Record<string, string> | null;
  isTeamView: boolean;
  isSystem: boolean;
  isPinned: boolean;
  userId: string | null;
}

/**
 * Horizontal bar of pinned saved-view chips above the lead table. Clicking a
 * chip applies the view; the chip matching the current URL is highlighted. A
 * star unpins (permission-gated to mirror the server action).
 */
export function PinnedViewsBar({
  views,
  currentUserId,
  userRole,
}: {
  views: PinnedView[];
  currentUserId: string;
  userRole: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const pinned = views.filter((v) => v.isPinned);
  if (pinned.length === 0) return null;

  const canManage = ["ADMIN", "MANAGER"].includes(userRole);

  function apply(view: PinnedView) {
    const params = buildViewParams(view, currentUserId);
    router.push(`${pathname}?${params.toString()}`);
  }

  function canUnpin(view: PinnedView) {
    return view.isTeamView ? canManage : view.userId === currentUserId;
  }

  function unpin(view: PinnedView) {
    startTransition(async () => {
      try {
        await togglePinView(view.id);
        toast({ title: "View unpinned" });
      } catch (e: unknown) {
        toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Pin className="h-3.5 w-3.5" />
        Pinned:
      </span>
      {pinned.map((view) => {
        const active = isViewActive(view, currentUserId, searchParams);
        return (
          <div
            key={view.id}
            className={`group flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-input bg-card text-foreground hover:bg-muted"
            }`}
          >
            <button onClick={() => apply(view)} className="flex items-center gap-1.5">
              {view.isTeamView && <Users className="h-3 w-3 opacity-70" />}
              {view.name}
            </button>
            {canUnpin(view) && (
              <button
                onClick={() => unpin(view)}
                disabled={isPending}
                title="Unpin view"
                className="opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-50"
              >
                <Star className="h-3 w-3 fill-current text-amber-500" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
