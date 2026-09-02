"use client";

import { useState, useTransition } from "react";
import { Save, Plus, X, ArrowRight } from "lucide-react";
import { updateSystemConfig } from "@/actions/config.actions";
import { toast } from "@/components/ui/use-toast";
import { SettingsSaveBar } from "@/components/admin/settings-save-bar";

interface FieldMappingSettingsProps {
  initialMapping: Record<string, string>;
}

export function FieldMappingSettings({ initialMapping }: FieldMappingSettingsProps) {
  const [rows, setRows] = useState<Array<{ formField: string; leadField: string }>>(
    () => Object.entries(initialMapping).map(([formField, leadField]) => ({ formField, leadField }))
  );
  const [isPending, startTransition] = useTransition();

  const unsaved =
    JSON.stringify(rows) !==
    JSON.stringify(Object.entries(initialMapping).map(([formField, leadField]) => ({ formField, leadField })));

  function handleChange(index: number, side: "formField" | "leadField", value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [side]: value } : row)));
  }

  function handleAdd() {
    setRows((prev) => [...prev, { formField: "", leadField: "" }]);
  }

  function handleRemove(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    // Filter out empty rows
    const filtered = rows.filter((r) => r.formField.trim() && r.leadField.trim());
    const mapping: Record<string, string> = {};
    for (const row of filtered) {
      mapping[row.formField.trim()] = row.leadField.trim();
    }

    startTransition(async () => {
      await updateSystemConfig("field_mapping", mapping);
      setRows(Object.entries(mapping).map(([formField, leadField]) => ({ formField, leadField })));
      toast({ title: "Field mapping updated", variant: "success" });
    });
  }

  return (
    <div>
      <h2 className="font-semibold mb-1">Ingestion Field Mapping</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Maps form field names to internal lead field names. Change these if the form&apos;s field names are updated.
      </p>

      <p className="text-xs text-muted-foreground mb-3">
        {rows.length} field mapping{rows.length !== 1 ? "s" : ""}
      </p>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Form Field</th>
              <th className="px-3 py-2 text-center font-medium text-muted-foreground w-10"></th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Lead Field</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b last:border-0">
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={row.formField}
                    onChange={(e) => handleChange(index, "formField", e.target.value)}
                    placeholder="e.g. firstName"
                    className="w-full rounded-md border border-input bg-card px-2.5 py-1 text-sm font-mono"
                  />
                </td>
                <td className="px-1 py-1.5 text-center text-muted-foreground">
                  <ArrowRight className="h-3.5 w-3.5 mx-auto" />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={row.leadField}
                    onChange={(e) => handleChange(index, "leadField", e.target.value)}
                    placeholder="e.g. first_name"
                    className="w-full rounded-md border border-input bg-card px-2.5 py-1 text-sm font-mono"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Remove mapping"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No field mappings configured. Click &quot;Add Mapping&quot; to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Mapping
        </button>
      </div>

      <SettingsSaveBar unsaved={unsaved}>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </button>
      </SettingsSaveBar>
    </div>
  );
}
