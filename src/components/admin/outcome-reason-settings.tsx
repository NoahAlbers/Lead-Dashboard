"use client";

import { useState, useTransition } from "react";
import { Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { upsertOutcomeReasonConfig, toggleOutcomeReasonConfig } from "@/actions/outcome.actions";
import { toast } from "@/components/ui/use-toast";

interface ReasonConfig {
  id: string;
  outcomeType: string;
  reasonText: string;
  sortOrder: number;
  active: boolean;
}

const OUTCOME_TYPES = [
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "disqualified", label: "Disqualified" },
  { value: "referred_out", label: "Referred Out" },
];

export function OutcomeReasonSettings({ initialConfigs }: { initialConfigs: ReasonConfig[] }) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [activeTab, setActiveTab] = useState("won");
  const [newReason, setNewReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = configs.filter((c) => c.outcomeType === activeTab);

  function handleAdd() {
    if (!newReason.trim()) return;
    startTransition(async () => {
      try {
        const created = await upsertOutcomeReasonConfig({
          outcomeType: activeTab,
          reasonText: newReason.trim(),
          sortOrder: filtered.length,
        });
        setConfigs((prev) => [...prev, { ...created, active: true }]);
        setNewReason("");
        toast({ title: "Reason added", variant: "success" });
      } catch {
        toast({ title: "Failed to add reason", variant: "destructive" });
      }
    });
  }

  function handleToggle(id: string, currentActive: boolean) {
    startTransition(async () => {
      try {
        await toggleOutcomeReasonConfig(id, !currentActive);
        setConfigs((prev) =>
          prev.map((c) => (c.id === id ? { ...c, active: !currentActive } : c))
        );
      } catch {
        toast({ title: "Failed to update", variant: "destructive" });
      }
    });
  }

  return (
    <div>
      <h2 className="font-semibold mb-2">Outcome Reasons</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Configure the reasons available for each outcome type in the Win/Loss modal.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {OUTCOME_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveTab(t.value)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Reason List */}
      <div className="space-y-1.5 mb-4">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No reasons configured for this type yet.
          </p>
        )}
        {filtered
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((config) => (
            <div
              key={config.id}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                config.active ? "" : "opacity-50"
              }`}
            >
              <span>{config.reasonText}</span>
              <button
                onClick={() => handleToggle(config.id, config.active)}
                disabled={isPending}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title={config.active ? "Deactivate" : "Activate"}
              >
                {config.active ? (
                  <ToggleRight className="h-5 w-5 text-primary" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
              </button>
            </div>
          ))}
      </div>

      {/* Add New */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newReason}
          onChange={(e) => setNewReason(e.target.value)}
          placeholder="New reason text..."
          className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={isPending || !newReason.trim()}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </div>
  );
}
