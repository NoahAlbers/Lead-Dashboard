"use client";

import { SlidersHorizontal } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useFilterParams } from "./use-filter-params";
import { MultiSelectFilter, type Option } from "./multi-select-filter";
import { NumericFilterRow } from "./numeric-filter-row";
import { StateFilterControl } from "./state-filter-control";
import { ComboFilterInput } from "./combo-filter-input";

// Common presets (property-management collections). Users can type any custom value.
const INDUSTRY_OPTIONS = [
  "Multi-Family", "Single Family", "Communities / HOA", "Commercial",
  "Mixed-Use", "Student Housing", "Senior Living", "Affordable Housing", "Vacation / Short-Term",
];
const DEBT_TYPE_OPTIONS = [
  "Residential Rental Debt", "Commercial Rent", "B2B / Commercial", "Consumer / B2C",
  "HOA Dues", "Tenant Damages", "Medical", "Judgments",
];
const BUSINESS_TYPE_OPTIONS = [
  "Conventional", "Student", "Senior / 55+", "Affordable / LIHTC",
  "Short-Term / Vacation", "Military", "Single-Family Rentals",
];
const SOFTWARE_OPTIONS = [
  "AppFolio", "Yardi", "Buildium", "RealPage", "Entrata", "Propertyware",
  "Rent Manager", "ResMan", "DoorLoop", "TenantCloud", "Rentvine",
];

const STATUS_OPTIONS: Option[] = [
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

const SLA_OPTIONS: Option[] = [
  { value: "on_track", label: "On Track" },
  { value: "warning", label: "At Risk" },
  { value: "breached", label: "Breached" },
  { value: "escalated", label: "Escalated" },
];

// Logical filter groups used to badge how many advanced filters are active.
const ACTIVE_GROUPS: string[][] = [
  ["states"], ["stateClass"], ["unitsMin", "unitsMax"], ["scoreMin", "scoreMax"],
  ["rentMin", "rentMax"], ["industry"], ["debtType"], ["businessType"], ["software"],
  ["status"], ["qualityTier"], ["slaStatus"], ["assignedUserId"],
  ["dateFrom", "dateTo"], ["ageMin"],
];

// Every URL param this panel owns — cleared together by "Clear advanced".
const ADVANCED_KEYS = ACTIVE_GROUPS.flat().concat("statesOp");

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </Label>
  );
}

export function AdvancedFiltersPanel({
  users,
  tierOptions,
  stateClassifications,
}: {
  users: { id: string; name: string }[];
  tierOptions: Option[];
  stateClassifications: Record<string, string>;
}) {
  const { searchParams, setMany } = useFilterParams();

  const activeCount = ACTIVE_GROUPS.filter((keys) =>
    keys.some((k) => searchParams.has(k))
  ).length;

  const assigneeOptions: Option[] = [
    { value: "__unassigned__", label: "Unassigned" },
    ...users.map((u) => ({ value: u.id, label: u.name })),
  ];

  function clearAdvanced() {
    setMany(Object.fromEntries(ADVANCED_KEYS.map((k) => [k, null])));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-medium text-muted-foreground hover:text-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Advanced Filters
          {activeCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[640px] max-h-[80vh] overflow-y-auto p-4">
        <div className="space-y-5">
          {/* Location / States */}
          <div className="space-y-2">
            <SectionLabel>Location / States</SectionLabel>
            <StateFilterControl stateClassifications={stateClassifications} />
          </div>

          {/* Business / Case */}
          <div className="space-y-2">
            <SectionLabel>Business / Case</SectionLabel>
            <div className="flex flex-wrap gap-2">
              <MultiSelectFilter label="Status" paramKey="status" options={STATUS_OPTIONS} />
              <MultiSelectFilter label="Tier" paramKey="qualityTier" options={tierOptions} />
              <MultiSelectFilter label="SLA" paramKey="slaStatus" options={SLA_OPTIONS} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ComboFilterInput label="Industry / Property Type" paramKey="industry" options={INDUSTRY_OPTIONS} />
              <ComboFilterInput label="Debt Type" paramKey="debtType" options={DEBT_TYPE_OPTIONS} />
              <ComboFilterInput label="Business / Rental Type" paramKey="businessType" options={BUSINESS_TYPE_OPTIONS} />
              <ComboFilterInput label="PM Software" paramKey="software" options={SOFTWARE_OPTIONS} />
            </div>
          </div>

          {/* Numbers */}
          <div className="space-y-2">
            <SectionLabel>Numbers</SectionLabel>
            <NumericFilterRow label="Units" fieldKey="units" />
            <NumericFilterRow label="Score" fieldKey="score" />
            <NumericFilterRow label="Avg Rent" fieldKey="rent" unit="/mo" />
          </div>

          {/* Dates + Assignee */}
          <div className="space-y-2">
            <SectionLabel>Dates &amp; Assignment</SectionLabel>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={searchParams.get("dateFrom") ?? ""}
                onChange={(e) => setMany({ dateFrom: e.target.value || null })}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={searchParams.get("dateTo") ?? ""}
                onChange={(e) => setMany({ dateTo: e.target.value || null })}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
              />
              <select
                value={searchParams.get("ageMin") ?? ""}
                onChange={(e) => setMany({ ageMin: e.target.value || null })}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm"
              >
                <option value="">Any Age</option>
                <option value="3">3+ days</option>
                <option value="7">7+ days</option>
                <option value="14">14+ days</option>
                <option value="30">30+ days</option>
              </select>
              <MultiSelectFilter
                label="Assignee"
                paramKey="assignedUserId"
                options={assigneeOptions}
              />
            </div>
          </div>

          <div className="flex justify-end border-t pt-3">
            <button
              onClick={clearAdvanced}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Clear advanced filters
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
