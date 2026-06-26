"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
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
}

export function LeadFilters({
  savedViews,
  currentUserId,
  userRole,
  stateClassifications = {},
  tierOptions = [],
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

  const isUnreadFilter = searchParams.get("isRead") === "false";

  const hasFilters = Array.from(searchParams.keys()).some(
    (k) => !["page", "pageSize", "sortField", "sortDirection"].includes(k)
  );

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px]">
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
