"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, Bookmark } from "lucide-react";
import { useState, useEffect } from "react";
import { getActiveUsers } from "@/actions/assignment.actions";

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

const SLA_OPTIONS = [
  { value: "on_track", label: "On Track" },
  { value: "warning", label: "At Risk" },
  { value: "breached", label: "Breached" },
  { value: "escalated", label: "Escalated" },
];

interface SavedViewDef {
  label: string;
  params: Record<string, string>;
}

const SAVED_VIEWS: SavedViewDef[] = [
  { label: "New Today", params: { status: "NEW", dateFrom: new Date().toISOString().slice(0, 10) } },
  { label: "Uncontacted", params: { status: "NEW,REVIEWED" } },
  { label: "SLA At Risk", params: { slaStatus: "warning,breached,escalated" } },
  { label: "Follow-Up Needed", params: { status: "FOLLOW_UP_NEEDED" } },
  { label: "Unassigned", params: { assignedUserId: "__unassigned__" } },
  { label: "Duplicates", params: { status: "DUPLICATE" } },
];

export function LeadFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") ?? ""
  );
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [showViews, setShowViews] = useState(false);

  useEffect(() => {
    getActiveUsers().then(setUsers);
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

  function applyView(view: SavedViewDef) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(view.params)) {
      params.set(k, v);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
    setShowViews(false);
  }

  const isUnreadFilter = searchParams.get("isRead") === "false";

  const hasFilters =
    searchParams.has("search") ||
    searchParams.has("status") ||
    searchParams.has("qualityTier") ||
    searchParams.has("state") ||
    searchParams.has("dateFrom") ||
    searchParams.has("isRead") ||
    searchParams.has("assignedUserId") ||
    searchParams.has("slaStatus");

  return (
    <div className="flex flex-wrap gap-3">
      <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search leads..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => updateParam("status", e.target.value || null)}
        className="h-9 rounded-md border border-input bg-card px-3 text-sm"
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
        className="h-9 rounded-md border border-input bg-card px-3 text-sm"
      >
        <option value="">All Tiers</option>
        {TIER_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("assignedUserId") ?? ""}
        onChange={(e) => updateParam("assignedUserId", e.target.value || null)}
        className="h-9 rounded-md border border-input bg-card px-3 text-sm"
      >
        <option value="">All Assignees</option>
        <option value="__unassigned__">Unassigned</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>

      <input
        type="date"
        value={searchParams.get("dateFrom") ?? ""}
        onChange={(e) => updateParam("dateFrom", e.target.value || null)}
        className="h-9 rounded-md border border-input bg-card px-3 text-sm"
        placeholder="From"
      />

      <input
        type="date"
        value={searchParams.get("dateTo") ?? ""}
        onChange={(e) => updateParam("dateTo", e.target.value || null)}
        className="h-9 rounded-md border border-input bg-card px-3 text-sm"
        placeholder="To"
      />

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

      {/* Saved Views */}
      <div className="relative">
        <button
          onClick={() => setShowViews(!showViews)}
          className="h-9 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
        >
          <Bookmark className="h-3.5 w-3.5" />
          Views
        </button>
        {showViews && (
          <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border bg-card shadow-lg z-50 py-1">
            {SAVED_VIEWS.map((view) => (
              <button
                key={view.label}
                onClick={() => applyView(view)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
              >
                {view.label}
              </button>
            ))}
          </div>
        )}
      </div>

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
  );
}
