"use client";

import { X } from "lucide-react";
import { useFilterParams } from "./use-filter-params";
import type { Option } from "./multi-select-filter";

const STATUS_LABELS: Record<string, string> = {
  NEW: "New", REVIEWED: "Reviewed", QUALIFIED: "Qualified", CONTACTED: "Contacted",
  FOLLOW_UP_NEEDED: "Follow-Up", REFERRED_OUT: "Referred", IMPORTED_TO_CRM: "In CRM",
  WON: "Won", LOST: "Lost", DISQUALIFIED: "Disqualified", DUPLICATE: "Duplicate",
};
const SLA_LABELS: Record<string, string> = {
  on_track: "On Track", warning: "At Risk", breached: "Breached", escalated: "Escalated",
};
const STATECLASS_LABELS: Record<string, string> = {
  any_good: "Any good state", only_good: "Only good states", any_bad: "Any bad state",
  only_bad: "Only bad states", mixed: "Mixed good/bad", unknown: "Unknown states",
};

function numericLabel(field: string, min: string | null, max: string | null): string | null {
  if (!min && !max) return null;
  if (min && max) return min === max ? `${field} = ${min}` : `${field} ${min}–${max}`;
  if (min) return `${field} ≥ ${min}`;
  return `${field} ≤ ${max}`;
}

export function ActiveFilterChips({
  users,
  tierOptions,
}: {
  users: { id: string; name: string }[];
  tierOptions: Option[];
}) {
  const { searchParams, setMany, router, pathname } = useFilterParams();
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const tierMap = new Map(tierOptions.map((t) => [t.value, t.label]));

  const chips: { key: string; label: string; clear: Record<string, null> }[] = [];

  const search = searchParams.get("search");
  if (search) chips.push({ key: "search", label: `Search: ${search}`, clear: { search: null } });

  const status = searchParams.get("status");
  if (status)
    chips.push({
      key: "status",
      label: `Status: ${status.split(",").map((s) => STATUS_LABELS[s] ?? s).join(", ")}`,
      clear: { status: null },
    });

  const tier = searchParams.get("qualityTier");
  if (tier)
    chips.push({
      key: "qualityTier",
      label: `Tier: ${tier.split(",").map((t) => tierMap.get(t) ?? t).join(", ")}`,
      clear: { qualityTier: null },
    });

  const sla = searchParams.get("slaStatus");
  if (sla)
    chips.push({
      key: "slaStatus",
      label: `SLA: ${sla.split(",").map((s) => SLA_LABELS[s] ?? s).join(", ")}`,
      clear: { slaStatus: null },
    });

  const stateClass = searchParams.get("stateClass");
  if (stateClass)
    chips.push({
      key: "stateClass",
      label: STATECLASS_LABELS[stateClass] ?? stateClass,
      clear: { stateClass: null },
    });

  const states = searchParams.get("states");
  if (states) {
    const op = searchParams.get("statesOp") === "none" ? "Excludes" : "States";
    chips.push({
      key: "states",
      label: `${op}: ${states}`,
      clear: { states: null, statesOp: null },
    });
  }

  const legacyState = searchParams.get("state");
  if (legacyState)
    chips.push({ key: "state", label: `State: ${legacyState}`, clear: { state: null } });

  const unitsLabel = numericLabel("Units", searchParams.get("unitsMin"), searchParams.get("unitsMax"));
  if (unitsLabel)
    chips.push({ key: "units", label: unitsLabel, clear: { unitsMin: null, unitsMax: null } });

  const scoreLabel = numericLabel("Score", searchParams.get("scoreMin"), searchParams.get("scoreMax"));
  if (scoreLabel)
    chips.push({ key: "score", label: scoreLabel, clear: { scoreMin: null, scoreMax: null } });

  const rentLabel = numericLabel("Avg Rent", searchParams.get("rentMin"), searchParams.get("rentMax"));
  if (rentLabel)
    chips.push({ key: "rent", label: rentLabel, clear: { rentMin: null, rentMax: null } });

  for (const f of ["industry", "debtType", "businessType"] as const) {
    const v = searchParams.get(f);
    if (v) {
      const niceField = f === "debtType" ? "Debt type" : f === "businessType" ? "Business type" : "Industry";
      chips.push({ key: f, label: `${niceField}: ${v}`, clear: { [f]: null } });
    }
  }

  const assignee = searchParams.get("assignedUserId");
  if (assignee)
    chips.push({
      key: "assignedUserId",
      label: `Assignee: ${assignee
        .split(",")
        .map((id) => (id === "__unassigned__" ? "Unassigned" : userMap.get(id) ?? id))
        .join(", ")}`,
      clear: { assignedUserId: null },
    });

  const dateFrom = searchParams.get("dateFrom");
  if (dateFrom) chips.push({ key: "dateFrom", label: `From: ${dateFrom}`, clear: { dateFrom: null } });
  const dateTo = searchParams.get("dateTo");
  if (dateTo) chips.push({ key: "dateTo", label: `To: ${dateTo}`, clear: { dateTo: null } });

  if (searchParams.get("ageMin"))
    chips.push({
      key: "ageMin",
      label: `Age ${searchParams.get("ageMin")}+ days`,
      clear: { ageMin: null },
    });

  if (searchParams.get("isRead") === "false")
    chips.push({ key: "isRead", label: "Unread", clear: { isRead: null } });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          onClick={() => setMany(chip.clear)}
          className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-0.5 text-xs text-foreground hover:bg-muted"
          title="Remove filter"
        >
          {chip.label}
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      ))}
      <button
        onClick={() => router.push(pathname)}
        className="rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
