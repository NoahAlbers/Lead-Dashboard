/**
 * Shared logic for applying a SavedView to the inbox URL. Used by both the
 * Saved Views dropdown and the Pinned Views bar so they never drift. Pure /
 * framework-light: callers do `router.push(`${pathname}?${buildViewParams(...)}`)`.
 */

export interface SavedViewLike {
  filtersJson: Record<string, string> | null;
  sortJson: Record<string, string> | null;
}

/** Resolve the dynamic tokens that system views use at apply-time. */
export function resolveFilterValue(
  key: string,
  value: string,
  currentUserId: string
): string {
  if (key === "assignedUserId" && value === "__me__") {
    return currentUserId;
  }
  if (key === "dateFrom") {
    if (value === "__today__") {
      return new Date().toISOString().slice(0, 10);
    }
    if (value === "__week_start__") {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(now.setDate(diff)).toISOString().slice(0, 10);
    }
  }
  return value;
}

/** Build the URLSearchParams that applying this view should produce. */
export function buildViewParams(
  view: SavedViewLike,
  currentUserId: string
): URLSearchParams {
  const params = new URLSearchParams();
  if (view.filtersJson) {
    for (const [k, v] of Object.entries(view.filtersJson)) {
      params.set(k, resolveFilterValue(k, v, currentUserId));
    }
  }
  if (view.sortJson) {
    for (const [k, v] of Object.entries(view.sortJson)) {
      params.set(k, v);
    }
  }
  params.set("page", "1");
  return params;
}

function normalize(p: URLSearchParams): string {
  const entries: [string, string][] = [];
  p.forEach((v, k) => {
    if (k === "page" || k === "pageSize") return;
    entries.push([k, v]);
  });
  entries.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  return entries.map(([k, v]) => `${k}=${v}`).join("&");
}

/** True when the current URL params match what this view would produce. */
export function isViewActive(
  view: SavedViewLike,
  currentUserId: string,
  current: URLSearchParams
): boolean {
  return normalize(buildViewParams(view, currentUserId)) === normalize(current);
}
