"use client";

import { useEffect } from "react";

export function NewLeadIndicator({ newCount }: { newCount: number }) {
  useEffect(() => {
    if (newCount > 0) {
      document.title = `(${newCount}) Lead Inbox — ACB`;
    } else {
      document.title = "Lead Inbox — ACB";
    }

    return () => {
      document.title = "ACB Lead Operations Console";
    };
  }, [newCount]);

  if (newCount <= 0) return null;

  return (
    <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold min-w-[22px] h-[22px] px-1.5">
      {newCount}
    </span>
  );
}
