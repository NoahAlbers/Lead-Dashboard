"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { updateSystemConfig } from "@/actions/config.actions";
import { toast } from "@/components/ui/use-toast";
import { SettingsSaveBar } from "@/components/admin/settings-save-bar";

interface AgingThresholdSettingsProps {
  initialThresholds: { green: number; yellow: number; orange: number; red: number };
}

export function AgingThresholdSettings({ initialThresholds }: AgingThresholdSettingsProps) {
  const [thresholds, setThresholds] = useState(initialThresholds);
  const [isPending, startTransition] = useTransition();

  function handleChange(field: keyof typeof thresholds, value: string) {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setThresholds((prev) => ({ ...prev, [field]: num }));
    }
  }

  function handleSave() {
    startTransition(async () => {
      await updateSystemConfig("aging_thresholds", thresholds);
      toast({ title: "Aging thresholds updated", variant: "success" });
    });
  }

  return (
    <div>
      <h2 className="font-semibold mb-1">Lead Aging Thresholds</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Configure the number of days for each aging color in the lead inbox.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1.5" />
            Green up to (days)
          </label>
          <input
            type="number"
            min={0}
            value={thresholds.green}
            onChange={(e) => handleChange("green", e.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 mr-1.5" />
            Yellow up to (days)
          </label>
          <input
            type="number"
            min={0}
            value={thresholds.yellow}
            onChange={(e) => handleChange("yellow", e.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500 mr-1.5" />
            Orange up to (days)
          </label>
          <input
            type="number"
            min={0}
            value={thresholds.orange}
            onChange={(e) => handleChange("orange", e.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5" />
            Red threshold (days)
          </label>
          <input
            type="number"
            min={0}
            value={thresholds.red}
            onChange={(e) => handleChange("red", e.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <SettingsSaveBar unsaved={JSON.stringify(thresholds) !== JSON.stringify(initialThresholds)}>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          Save Thresholds
        </button>
      </SettingsSaveBar>
    </div>
  );
}
