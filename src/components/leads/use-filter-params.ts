"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

/**
 * Shared URL-searchParams writer for all inbox filter controls. Every filter is
 * a URL param (so saved views snapshot them automatically). Writing always
 * resets pagination to page 1.
 */
export function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setMany = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      }
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const setParam = useCallback(
    (key: string, value: string | null) => setMany({ [key]: value }),
    [setMany]
  );

  return { searchParams, setParam, setMany, pathname, router };
}
