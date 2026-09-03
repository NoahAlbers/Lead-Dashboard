"use client";

// Contact Information, once an account has more than one person in it.
//
// The person who filled in the form stays first and stays primary: every email,
// referral and export in the console points at them, so nothing here moves
// them. Anyone a rep picks up afterwards, an owner, an office manager, whoever
// actually handles the ledger, gets their own tab beside them.
//
// With nobody else on the account there are no tabs at all, just the card as it
// has always looked, so the common case stays quiet.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CopyButton } from "@/components/shared/copy-button";
import { toast } from "@/components/ui/use-toast";
import { addLeadContact, updateLeadContact, deleteLeadContact } from "@/actions/contact.actions";

/** More actions dispatches this so its menu item can open the same dialog. */
export const ADD_CONTACT_EVENT = "acb:add-contact";

export interface ExtraContact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  notes: string | null;
}

const EMPTY = { name: "", title: "", email: "", phone: "", alternatePhone: "", notes: "" };

export function ContactTabs({
  leadId,
  primaryLabel,
  contacts,
  children,
}: {
  leadId: string;
  /** Name for the first tab, usually whoever filled in the form. */
  primaryLabel: string;
  contacts: ExtraContact[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [active, setActive] = useState<string>("primary");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const open = () => {
      setEditingId(null);
      setForm({ ...EMPTY });
      setDialogOpen(true);
    };
    window.addEventListener(ADD_CONTACT_EVENT, open);
    return () => window.removeEventListener(ADD_CONTACT_EVENT, open);
  }, []);

  // A removed contact must not leave the card showing an empty tab.
  useEffect(() => {
    if (active !== "primary" && !contacts.some((c) => c.id === active)) setActive("primary");
  }, [contacts, active]);

  function save() {
    startTransition(async () => {
      const res = editingId
        ? await updateLeadContact(editingId, form)
        : await addLeadContact(leadId, form);
      if (!res.success) {
        toast({ title: "Not saved", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: editingId ? "Contact updated" : `${form.name.trim()} added`, variant: "success" });
      setDialogOpen(false);
      router.refresh();
    });
  }

  function remove(contact: ExtraContact) {
    startTransition(async () => {
      await deleteLeadContact(contact.id);
      toast({ title: `${contact.name} removed` });
      setActive("primary");
      router.refresh();
    });
  }

  const showing = contacts.find((c) => c.id === active) ?? null;

  return (
    <>
      {contacts.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1 border-b pb-1.5">
          <TabButton active={active === "primary"} onClick={() => setActive("primary")}>
            {primaryLabel}
          </TabButton>
          {contacts.map((c) => (
            <TabButton key={c.id} active={active === c.id} onClick={() => setActive(c.id)}>
              {c.name}
            </TabButton>
          ))}
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({ ...EMPTY });
              setDialogOpen(true);
            }}
            title="Add another contact"
            className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="sr-only">Add another contact</span>
          </button>
        </div>
      )}

      {/* The primary contact is server rendered, tabs or no tabs, so it keeps
          its inline editing and its links. Hidden rather than unmounted so
          nothing half-typed is thrown away by a tab click. */}
      <div hidden={active !== "primary"}>{children}</div>

      {showing && (
        <div className="divide-y divide-border/60">
          <Field label="Name" value={showing.name} copy />
          <Field label="Title" value={showing.title} />
          <Field label="Email" value={showing.email} copy href={showing.email ? `mailto:${showing.email}` : undefined} />
          <Field label="Phone" value={showing.phone} copy href={showing.phone ? `tel:${showing.phone}` : undefined} />
          <Field
            label="Alt. Phone"
            value={showing.alternatePhone}
            copy
            href={showing.alternatePhone ? `tel:${showing.alternatePhone}` : undefined}
          />
          <Field label="Notes" value={showing.notes} />
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setEditingId(showing.id);
                setForm({
                  name: showing.name,
                  title: showing.title ?? "",
                  email: showing.email ?? "",
                  phone: showing.phone ?? "",
                  alternatePhone: showing.alternatePhone ?? "",
                  notes: showing.notes ?? "",
                });
                setDialogOpen(true);
              }}
              className="rounded-md border px-2 py-1 text-[11px] font-medium hover:bg-muted"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => remove(showing)}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o && !isPending) setDialogOpen(false); }}>
        <DialogContent closeDisabled={isPending}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              {editingId ? "Edit contact" : "Add another contact"}
            </DialogTitle>
            <DialogDescription>
              Someone else at this account worth talking to. The person who filled in the form stays
              the primary contact.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Input label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Office manager" />
            <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="name@company.com" />
            <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(555) 555-5555" />
            <Input
              label="Alt. phone"
              value={form.alternatePhone}
              onChange={(v) => setForm({ ...form, alternatePhone: v })}
            />
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Best time to reach them, what they handle, anything worth remembering."
                className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={isPending || !form.name.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Saving..." : editingId ? "Save changes" : "Add contact"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`max-w-[140px] truncate rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  copy,
  href,
}: {
  label: string;
  value: string | null;
  copy?: boolean;
  href?: string;
}) {
  if (!value) return null;
  return (
    <div className="py-1.5 text-[13px]">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="group mt-0.5 flex items-start break-words font-medium leading-snug">
        <span className="min-w-0 flex-1">
          {href ? (
            <a href={href} className="text-primary hover:underline break-all">
              {value}
            </a>
          ) : (
            value
          )}
        </span>
        {copy && <CopyButton value={value} label={label.toLowerCase()} />}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}
