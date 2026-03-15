"use client";

import { useState, useTransition } from "react";
import { Trash2, Plus, RotateCcw, Save } from "lucide-react";
import { createCustomStatus, deleteCustomStatus, saveTierRanges } from "@/actions/status.actions";
import { unarchiveLead } from "@/actions/lead.actions";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";

const PASTEL_COLORS = [
  "#FFB3B3", "#FFDAB3", "#FFF3B3", "#D4F5D4",
  "#B3E8D4", "#B3E8F5", "#B3D4FF", "#C7B3FF",
  "#E8B3FF", "#FFB3E8", "#F5D4B3", "#D4D4D4",
];

interface StatusItem {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
}

interface TierRange {
  tier: string;
  label: string;
  min: number;
  max: number;
  color: string;
}

interface ArchivedLead {
  id: string;
  fullName: string | null;
  companyName: string | null;
  email: string | null;
  createdAt: string;
  score: number | null;
}

interface SettingsClientProps {
  statuses: StatusItem[];
  tiers: StatusItem[];
  archivedLeads: ArchivedLead[];
  tierRanges: TierRange[];
}

function StatusList({
  items,
  type,
  label,
}: {
  items: StatusItem[];
  type: string;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PASTEL_COLORS[0]);

  function handleAdd() {
    if (!newName.trim()) return;
    startTransition(async () => {
      await createCustomStatus({ name: newName.trim(), color: newColor, type });
      setNewName("");
      setShowAdd(false);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteCustomStatus(id);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{label}</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add {type === "status" ? "Status" : "Tier"}
        </button>
      </div>

      {showAdd && (
        <div className="rounded-lg border bg-muted/30 p-3 mb-3 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`${type === "status" ? "Status" : "Tier"} name...`}
            className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Color</p>
            <div className="flex flex-wrap gap-1.5">
              {PASTEL_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewColor(color)}
                  className={`h-7 w-7 rounded-md border-2 transition-transform ${
                    newColor === color ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || isPending}
              className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewName(""); }}
              className="rounded-md px-3 py-1 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-center justify-between rounded-md border p-3"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm font-medium">{item.name}</span>
            </div>
            {!item.isDefault && (
              <button
                onClick={() => handleDelete(item.id)}
                disabled={isPending}
                className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TierRangeEditor({ initialRanges }: { initialRanges: TierRange[] }) {
  const [ranges, setRanges] = useState(initialRanges);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateRange(tier: string, field: "min" | "max", value: number) {
    setRanges((prev) =>
      prev.map((r) => (r.tier === tier ? { ...r, [field]: value } : r))
    );
    setError(null);
  }

  function validate(): boolean {
    // Sort by min descending (A has highest range)
    const sorted = [...ranges].sort((a, b) => b.min - a.min);

    // Check no overlaps and full coverage
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].min > sorted[i].max) {
        setError(`${sorted[i].label}: min cannot exceed max.`);
        return false;
      }
      if (i > 0 && sorted[i].max >= sorted[i - 1].min) {
        setError(`${sorted[i].label} overlaps with ${sorted[i - 1].label}.`);
        return false;
      }
    }

    // Check coverage of 0-100
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];
    if (highest.max !== 100) {
      setError("Top tier must end at 100.");
      return false;
    }
    if (lowest.min !== 0) {
      setError("Bottom tier must start at 0.");
      return false;
    }

    return true;
  }

  function handleSave() {
    if (!validate()) return;
    startTransition(async () => {
      await saveTierRanges(ranges.map((r) => ({ tier: r.tier, min: r.min, max: r.max })));
      toast({ title: "Tier ranges saved", description: "Quality tier boundaries updated." });
    });
  }

  const TIER_DISPLAY_COLORS: Record<string, string> = {
    A: "border-emerald-200 bg-emerald-50",
    B: "border-blue-200 bg-blue-50",
    C: "border-amber-200 bg-amber-50",
    POOR: "border-red-200 bg-red-50",
  };

  return (
    <div>
      <h2 className="font-semibold mb-3">Quality Tier Score Ranges</h2>
      <p className="text-sm text-muted-foreground mb-3">
        Define which score ranges map to each tier. Ranges must cover 0-100 without overlap.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ranges.map((range) => (
          <div
            key={range.tier}
            className={`rounded-lg border p-3 ${TIER_DISPLAY_COLORS[range.tier] ?? ""}`}
          >
            <p className="text-sm font-semibold mb-2">{range.label}</p>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                value={range.min}
                onChange={(e) => updateRange(range.tier, "min", Number(e.target.value))}
                className="w-14 rounded border border-input bg-card px-2 py-1 text-sm text-center"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="number"
                min={0}
                max={100}
                value={range.max}
                onChange={(e) => updateRange(range.tier, "max", Number(e.target.value))}
                className="w-14 rounded border border-input bg-card px-2 py-1 text-sm text-center"
              />
            </div>
          </div>
        ))}
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}
      <button
        onClick={handleSave}
        disabled={isPending}
        className="mt-3 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" />
        Save Ranges
      </button>
    </div>
  );
}

export function SettingsClient({ statuses, tiers, archivedLeads, tierRanges }: SettingsClientProps) {
  const [isPending, startTransition] = useTransition();

  function handleRestore(leadId: string) {
    startTransition(async () => {
      await unarchiveLead(leadId);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-5 space-y-6">
        <StatusList items={statuses} type="status" label="Lead Statuses" />
        <TierRangeEditor initialRanges={tierRanges} />
        <StatusList items={tiers} type="tier" label="Custom Tiers" />
      </div>

      {/* Archived Leads */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold mb-3">Archived Leads</h2>
        {archivedLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No archived leads.</p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name / Company</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Created</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Score</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {archivedLeads.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      {lead.companyName || lead.fullName || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">{lead.email || "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {format(new Date(lead.createdAt), "MM/dd/yy")}
                    </td>
                    <td className="px-3 py-2">{lead.score ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleRestore(lead.id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
