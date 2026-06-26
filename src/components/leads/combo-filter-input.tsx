"use client";

import { useFilterParams } from "./use-filter-params";

/**
 * A text filter with a dropdown of common presets (via native <datalist>) that
 * still lets the user type any custom value. Commits a preset immediately on
 * select, and free text on blur / Enter.
 */
export function ComboFilterInput({
  label,
  paramKey,
  options,
  placeholder,
}: {
  label: string;
  paramKey: string;
  options: string[];
  placeholder?: string;
}) {
  const { searchParams, setMany } = useFilterParams();
  const listId = `combo-${paramKey}`;
  const current = searchParams.get(paramKey) ?? "";

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        list={listId}
        defaultValue={current}
        onChange={(e) => {
          // Picking a preset from the dropdown commits immediately.
          if (options.includes(e.target.value)) setMany({ [paramKey]: e.target.value });
        }}
        onBlur={(e) => setMany({ [paramKey]: e.target.value.trim() || null })}
        onKeyDown={(e) => {
          if (e.key === "Enter") setMany({ [paramKey]: (e.target as HTMLInputElement).value.trim() || null });
        }}
        placeholder={placeholder ?? `Any ${label.toLowerCase()}`}
        className="h-8 rounded-md border border-input bg-card px-2 text-sm"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </label>
  );
}
