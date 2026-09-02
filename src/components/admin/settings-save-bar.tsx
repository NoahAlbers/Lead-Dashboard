"use client";

import type { ReactNode } from "react";

/**
 * Sticky action bar for the bottom of a settings card. Bleeds to the card
 * edges (cards use p-5) so it reads as part of the card while pinned to the
 * viewport bottom during a long scroll.
 */
export function SettingsSaveBar({
  children,
  unsaved = false,
  hint,
}: {
  children: ReactNode;
  /** Show the "Unsaved changes" hint on the left. */
  unsaved?: boolean;
  /** Override the hint text (only shown when `unsaved` is true). */
  hint?: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-4 flex items-center justify-end gap-2 rounded-b-lg border-t bg-card/95 px-5 py-2 backdrop-blur">
      {unsaved && (
        <span className="mr-auto text-xs text-amber-600 dark:text-amber-400">
          {hint ?? "Unsaved changes"}
        </span>
      )}
      {children}
    </div>
  );
}
