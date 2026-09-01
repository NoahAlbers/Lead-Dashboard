"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
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
  { key: "fullName", label: "Full Name" },
  { key: "companyName", label: "Company" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "alternatePhone", label: "Alt. Phone" },
  { key: "title", label: "Title" },
  { key: "address1", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "Zip" },
  { key: "industry", label: "Industry / Property Types" },
  { key: "debtType", label: "Debt Type" },
  { key: "businessType", label: "Business / Rental Type" },
  { key: "accountVolume", label: "Total Units" },
  { key: "urgency", label: "Urgency" },
  { key: "notesFromForm", label: "Form Notes", wide: true, textarea: true },
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
    <>
      <button
        onClick={openDialog}
        className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Edit lead details (changes are logged to the timeline)"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
          <div
            className="bg-card rounded-xl border shadow-lg w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold">Edit Lead</h3>
                <p className="text-xs text-muted-foreground">Every change is recorded in the lead's history.</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setOpen(false)} className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
