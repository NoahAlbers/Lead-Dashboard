"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { updateLeadDetails } from "@/actions/lead.actions";
import { toast } from "@/components/ui/use-toast";

interface EditableLead {
  id: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  title?: string | null;
  address1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  industry?: string | null;
  debtType?: string | null;
  businessType?: string | null;
  accountVolume?: string | null;
  urgency?: string | null;
  notesFromForm?: string | null;
}

const FIELDS: Array<{ key: keyof EditableLead & string; label: string; wide?: boolean; textarea?: boolean }> = [
  { key: "fullName", label: "Full name" },
  { key: "companyName", label: "Company" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "alternatePhone", label: "Alt. phone" },
  { key: "title", label: "Title" },
  { key: "address1", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "Zip" },
  { key: "industry", label: "Industry / property types" },
  { key: "debtType", label: "Debt type" },
  { key: "businessType", label: "Business / rental type" },
  { key: "accountVolume", label: "Total units" },
  { key: "urgency", label: "Urgency" },
  { key: "notesFromForm", label: "Form notes", wide: true, textarea: true },
];

export function LeadEditDialog({ lead }: { lead: EditableLead }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function openDialog() {
    const init: Record<string, string> = {};
    for (const f of FIELDS) init[f.key] = (lead[f.key] as string | null) ?? "";
    setValues(init);
    setOpen(true);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      openDialog();
      return;
    }
    // Keep the dialog up while a save is in flight.
    if (saving) return;
    setOpen(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await updateLeadDetails(lead.id, values);
      if (res.changed > 0) {
        toast({ title: `Lead updated (${res.changed} field${res.changed === 1 ? "" : "s"} changed)`, variant: "success" });
      } else {
        toast({ title: "No changes to save" });
      }
      setOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Failed to update lead", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Edit lead details (changes are logged to the timeline)"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </DialogTrigger>

      <DialogContent size="2xl" scrollable closeDisabled={saving}>
        <DialogHeader>
          <DialogTitle>Edit lead</DialogTitle>
          <DialogDescription>Every change is recorded in the lead's history.</DialogDescription>
        </DialogHeader>

        <DialogBody className="-mx-1 px-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <label key={f.key} className={`text-sm space-y-1 block ${f.wide ? "sm:col-span-2" : ""}`}>
                <span className="font-medium">{f.label}</span>
                {f.textarea ? (
                  <textarea
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    rows={3}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  />
                ) : (
                  <input
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm"
                  />
                )}
              </label>
            ))}
          </div>
        </DialogBody>

        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
