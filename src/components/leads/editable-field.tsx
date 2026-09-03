"use client";

// A lead field you can fix without leaving the page.
//
// Reading is the normal state and stays quiet: the value renders exactly as it
// did before, and a copy and a pencil fade in only when the pointer is over the
// row. Clicking the pencil swaps that one value for the right control, which
// depends on the answer: free text gets an input, an answer with a fixed set of
// choices gets those choices laid out as pills, so nobody has to remember how
// the form worded "Affordable / Section 8".
//
// Saves go through the same server actions the edit dialog uses, so every
// correction lands in the timeline the same way.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { CopyButton } from "@/components/shared/copy-button";
import { toast } from "@/components/ui/use-toast";
import { updateLeadDetails } from "@/actions/lead.actions";
import { updateLeadIntakeField } from "@/actions/intake-field.actions";

type Kind = "text" | "textarea" | "select" | "multiselect";

interface EditableFieldProps {
  leadId: string;
  /** Lead column name, or intake answer key when target is "intake". */
  field: string;
  target: "lead" | "intake";
  kind?: Kind;
  /** Current value. An array for multiselect, a string otherwise. */
  value: string | string[] | null | undefined;
  /** Choices for select and multiselect. */
  options?: readonly string[];
  /** What to show when not editing. Falls back to the plain value. */
  display?: React.ReactNode;
  /** When set, a copy button appears beside the value. */
  copyValue?: string | null;
  copyLabel?: string;
  placeholder?: string;
  /** Shown in place of the value when there is nothing yet. */
  emptyLabel?: string;
  className?: string;
}

export function EditableField({
  leadId,
  field,
  target,
  kind = "text",
  value,
  options,
  display,
  copyValue,
  copyLabel,
  placeholder,
  emptyLabel = "Not given",
  className,
}: EditableFieldProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [isSaving, startSaving] = useTransition();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const current = Array.isArray(value) ? value : value ? [value] : [];

  useEffect(() => {
    if (!editing) return;
    setText(Array.isArray(value) ? value.join(", ") : (value ?? ""));
    setPicked(current);
    setFilter("");
    // Focus lands on the input a tick later, once it exists.
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function save(next: string | string[] | null) {
    startSaving(async () => {
      try {
        const res =
          target === "intake"
            ? await updateLeadIntakeField(leadId, field, next)
            : await updateLeadDetails(leadId, { [field]: Array.isArray(next) ? next.join(", ") : next });
        if (res && "success" in res && res.success === false) {
          toast({ title: "Not saved", description: res.error, variant: "destructive" });
          return;
        }
        setEditing(false);
        router.refresh();
      } catch {
        toast({ title: "Not saved", description: "Something went wrong saving that.", variant: "destructive" });
      }
    });
  }

  if (!editing) {
    const isEmpty = current.length === 0;
    return (
      <span className={`group/edit inline-flex w-full items-start gap-0.5 ${className ?? ""}`}>
        <span className={`min-w-0 flex-1 ${isEmpty ? "italic text-muted-foreground" : ""}`}>
          {isEmpty ? emptyLabel : (display ?? current.join(", "))}
        </span>
        <span className="flex shrink-0 items-center">
          {copyValue && <CopyButton value={copyValue} label={copyLabel} />}
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Edit"
            className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/edit:opacity-100 focus-visible:opacity-100"
          >
            <Pencil className="h-3 w-3" />
            <span className="sr-only">Edit {field}</span>
          </button>
        </span>
      </span>
    );
  }

  const inputClass =
    "w-full rounded-md border border-input bg-card px-2 py-1 text-[13px] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (kind === "select" || kind === "multiselect") {
    const multi = kind === "multiselect";
    const list = options ?? [];
    // A long list of choices is unusable without a way to narrow it, and a
    // short one does not need the extra box.
    const searchable = list.length > 12;
    const shown = searchable
      ? list.filter((o) => o.toLowerCase().includes(filter.trim().toLowerCase()))
      : list;

    return (
      <div className="space-y-1.5">
        {searchable && (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Type to narrow the list"
            className={inputClass}
          />
        )}
        <div className="flex flex-wrap gap-1">
          {shown.map((option) => {
            const on = picked.includes(option);
            return (
              <button
                key={option}
                type="button"
                disabled={isSaving}
                onClick={() => {
                  if (multi) {
                    setPicked((p) => (p.includes(option) ? p.filter((x) => x !== option) : [...p, option]));
                  } else {
                    save(on ? null : option);
                  }
                }}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
                  on
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {option}
              </button>
            );
          })}
          {shown.length === 0 && (
            <p className="text-[11px] italic text-muted-foreground">Nothing matches that.</p>
          )}
        </div>
        {/* Anything already on the lead that the form never offered stays
            visible so an edit cannot quietly drop it. */}
        {picked.filter((p) => !list.includes(p)).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {picked
              .filter((p) => !list.includes(p))
              .map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPicked((prev) => prev.filter((x) => x !== p))}
                  title="Remove"
                  className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
                >
                  {p}
                  <X className="h-2.5 w-2.5" />
                </button>
              ))}
          </div>
        )}
        <Buttons
          saving={isSaving}
          onCancel={() => setEditing(false)}
          onSave={multi ? () => save(picked) : undefined}
          hint={multi ? undefined : "Pick one, or click it again to clear it."}
        />
      </div>
    );
  }

  if (kind === "textarea") {
    return (
      <div className="space-y-1.5">
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
          rows={4}
          placeholder={placeholder}
          className={inputClass}
        />
        <Buttons saving={isSaving} onCancel={() => setEditing(false)} onSave={() => save(text)} />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save(text);
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder={placeholder}
        className={inputClass}
      />
      <Buttons saving={isSaving} onCancel={() => setEditing(false)} onSave={() => save(text)} />
    </div>
  );
}

function Buttons({
  saving,
  onSave,
  onCancel,
  hint,
}: {
  saving: boolean;
  onSave?: () => void;
  onCancel: () => void;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {onSave && (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Check className="h-3 w-3" />
          {saving ? "Saving..." : "Save"}
        </button>
      )}
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        Cancel
      </button>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
