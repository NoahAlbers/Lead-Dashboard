"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { useState } from "react";

const STATUS_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "FOLLOW_UP_NEEDED", label: "Follow-Up" },
  { value: "REFERRED_OUT", label: "Referred" },
  { value: "IMPORTED_TO_CRM", label: "In CRM" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "DISQUALIFIED", label: "Disqualified" },
  { value: "DUPLICATE", label: "Duplicate" },
];

const TIER_OPTIONS = [
  { value: "A", label: "A Lead" },
  { value: "B", label: "B Lead" },
  { value: "C", label: "C Lead" },
  { value: "POOR", label: "Poor Fit" },
];

interface SavedView {
  id: string;
  name: string;
  filtersJson: Record<string, unknown> | null;
  sortJson: Record<string, string> | null;
}

export function LeadFilters({ savedViews }: { savedViews: SavedView[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") ?? ""
  );

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParam("search", searchInput || null);
  }

  function clearFilters() {
    router.push(pathname);
    setSearchInput("");
  }

  function applySavedView(view: SavedView) {
    const params = new URLSearchParams();
    const filters = view.filtersJson as Record<string, unknown> | null;
    const sort = view.sortJson as Record<string, string> | null;

    if (filters) {
      if (filters.status && Array.isArray(filters.status)) {
        params.set("status", (filters.status as string[]).join(","));
      }
      if (filters.qualityTier && Array.isArray(filters.qualityTier)) {
        params.set("qualityTier", (filters.qualityTier as string[]).join(","));
      }
    }
    if (sort) {
      if (sort.field) params.set("sortField", sort.field);
      if (sort.direction) params.set("sortDirection", sort.direction);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters =
    searchParams.has("search") ||
    searchParams.has("status") ||
    searchParams.has("qualityTier") ||
    searchParams.has("state") ||
    searchParams.has("dateFrom");

  return (
    <div className="space-y-3">
      {/* Saved Views */}
      {savedViews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {savedViews.map((view) => (
            <button
              key={view.id}
              onClick={() => applySavedView(view)}
              className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted transition-colors"
            >
              {view.name}
            </button>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </form>

        <select
          value={searchParams.get("status") ?? ""}
          onChange={(e) => updateParam("status", e.target.value || null)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("qualityTier") ?? ""}
          onChange={(e) => updateParam("qualityTier", e.target.value || null)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Tiers</option>
          {TIER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={searchParams.get("dateFrom") ?? ""}
          onChange={(e) => updateParam("dateFrom", e.target.value || null)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          placeholder="From"
        />

        <input
          type="date"
          value={searchParams.get("dateTo") ?? ""}
          onChange={(e) => updateParam("dateTo", e.target.value || null)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          placeholder="To"
        />

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-md px-3 py-1 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
