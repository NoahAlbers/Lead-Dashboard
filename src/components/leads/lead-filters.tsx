"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, Settings2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { getActiveUsers } from "@/actions/assignment.actions";
import { SavedViewsPanel } from "./saved-views-panel";
import { AdvancedFiltersPanel } from "./advanced-filters-panel";
import { ActiveFilterChips } from "./active-filter-chips";
import type { Option } from "./multi-select-filter";

interface SavedView {
  id: string;
  name: string;
  filtersJson: Record<string, string> | null;
  sortJson: Record<string, string> | null;
  isTeamView: boolean;
  isSystem: boolean;
  isPinned: boolean;
  userId: string | null;
}

interface LeadFiltersProps {
  savedViews?: SavedView[];
  currentUserId?: string;
  userRole?: string;
  stateClassifications?: Record<string, string>;
  tierOptions?: Option[];
  /** Extra controls (e.g. the Columns button) rendered at the end of the row. */
  trailing?: React.ReactNode;
}

export function LeadFilters({
  savedViews,
  currentUserId,
  userRole,
  stateClassifications = {},
  tierOptions = [],
  trailing,
}: LeadFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") ?? ""
  );
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([]);

  useEffect(() => {
    getActiveUsers().then(setUsers);
  }, []);

  // Listen for focus-search custom event from keyboard shortcut provider
  useEffect(() => {
    function handleFocusSearch() {
      searchInputRef.current?.focus();
    }
    window.addEventListener("focus-search", handleFocusSearch);
    return () => window.removeEventListener("focus-search", handleFocusSearch);
  }, []);

  // Live search: debounce URL updates as the user types (Enter still applies instantly).
  useEffect(() => {
    const current = searchParams.get("search") ?? "";
    if (searchInput === current) return;
    const t = setTimeout(() => updateParam("search", searchInput.trim() || null), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Keep the input in sync when the URL search changes elsewhere (Clear, saved view).
  useEffect(() => {
    setSearchInput(searchParams.get("search") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
    // Keep the Inquiries/Abandoned tab selection when clearing filters.
    const view = searchParams.get("view");
    router.push(view ? `${pathname}?view=${view}` : pathname);
    setSearchInput("");
  }

  const isUnreadFilter = searchParams.get("isRead") === "false";

  const hasFilters = Array.from(searchParams.keys()).some(
    (k) => !["page", "pageSize", "sortField", "sortDirection", "view"].includes(k)
  );

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="relative w-72 max-w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search leads..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </form>

        <button
          onClick={() => updateParam("isRead", isUnreadFilter ? null : "false")}
          className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors ${
            isUnreadFilter
              ? "border-primary bg-primary/10 text-primary"
              : "border-input bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          Unread
        </button>

        <AdvancedFiltersPanel
          users={users}
          tierOptions={tierOptions}
          stateClassifications={stateClassifications}
        />

        {/* Saved Views */}
        {savedViews && currentUserId && userRole && (
          <SavedViewsPanel
            views={savedViews}
            currentUserId={currentUserId}
            userRole={userRole}
          />
        )}

        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-column-picker"))}
          className="flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Columns
        </button>

        {trailing}

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

      <ActiveFilterChips users={users} tierOptions={tierOptions} />
    </div>
  );
}
