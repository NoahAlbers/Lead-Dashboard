"use client";

import { useState, useTransition } from "react";
import { createPartner, updatePartner, deletePartner } from "@/actions/partner.actions";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getStateColor } from "@/lib/state-colors";

interface Partner {
  id: string;
  name: string;
  active: boolean;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  statesServedJson: unknown;
  industriesServedJson: unknown;
  specialtiesJson: unknown;
  preferredLeadTypesJson: unknown;
  minimumClaimSize: number | null;
  maximumClaimSize: number | null;
  exclusionsJson: unknown;
  notes: string | null;
  rankingPriority: number;
  createdAt: string;
  updatedAt: string;
  // Financial Terms
  contingencyRate: string | null;
  upfrontCosts: string | null;
  paymentTerms: string | null;
  commissionStructure: string | null;
  // Account Requirements
  minimumAccounts: number | null;
  minimumTotalBalance: number | null;
  avgAccountAgePref: string | null;
  accountTypesAccepted: string | null;
  // Service Details
  collectionMethods: string | null;
  licensedStatesJson: unknown;
  insuranceInfo: string | null;
  yearsInBusiness: number | null;
  complianceNotes: string | null;
}

export function PartnersManager({ initialPartners, stateClassifications = {} }: { initialPartners: Partner[]; stateClassifications?: Record<string, string> }) {
  const [partners, setPartners] = useState(initialPartners);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [confirmState, setConfirmState] = useState<{ action: () => void } | null>(null);

  const [form, setForm] = useState({
    name: "",
    active: true,
    contactName: "",
    email: "",
    phone: "",
    website: "",
    statesServed: "",
    industriesServed: "",
    specialties: "",
    preferredLeadTypes: "",
    minimumClaimSize: "",
    maximumClaimSize: "",
    exclusions: "",
    notes: "",
    rankingPriority: 0,
    // Financial Terms
    contingencyRate: "",
    upfrontCosts: "",
    paymentTerms: "",
    commissionStructure: "",
    // Account Requirements
    minimumAccounts: "",
    minimumTotalBalance: "",
    avgAccountAgePref: "",
    accountTypesAccepted: "",
    // Service Details
    collectionMethods: "",
    licensedStates: "",
    insuranceInfo: "",
    yearsInBusiness: "",
    complianceNotes: "",
  });

  function resetForm() {
    setForm({
      name: "", active: true, contactName: "", email: "", phone: "", website: "",
      statesServed: "", industriesServed: "", specialties: "", preferredLeadTypes: "",
      minimumClaimSize: "", maximumClaimSize: "", exclusions: "", notes: "", rankingPriority: 0,
      contingencyRate: "", upfrontCosts: "", paymentTerms: "", commissionStructure: "",
      minimumAccounts: "", minimumTotalBalance: "", avgAccountAgePref: "", accountTypesAccepted: "",
      collectionMethods: "", licensedStates: "", insuranceInfo: "", yearsInBusiness: "", complianceNotes: "",
    });
    setEditing(null);
    setIsCreating(false);
  }

  function startEdit(partner: Partner) {
    setEditing(partner);
    setForm({
      name: partner.name,
      active: partner.active,
      contactName: partner.contactName ?? "",
      email: partner.email ?? "",
      phone: partner.phone ?? "",
      website: partner.website ?? "",
      statesServed: Array.isArray(partner.statesServedJson) ? (partner.statesServedJson as string[]).join(", ") : "",
      industriesServed: Array.isArray(partner.industriesServedJson) ? (partner.industriesServedJson as string[]).join(", ") : "",
      specialties: Array.isArray(partner.specialtiesJson) ? (partner.specialtiesJson as string[]).join(", ") : "",
      preferredLeadTypes: Array.isArray(partner.preferredLeadTypesJson) ? (partner.preferredLeadTypesJson as string[]).join(", ") : "",
      minimumClaimSize: partner.minimumClaimSize?.toString() ?? "",
      maximumClaimSize: partner.maximumClaimSize?.toString() ?? "",
      exclusions: Array.isArray(partner.exclusionsJson) ? (partner.exclusionsJson as string[]).join(", ") : "",
      notes: partner.notes ?? "",
      rankingPriority: partner.rankingPriority,
      contingencyRate: partner.contingencyRate ?? "",
      upfrontCosts: partner.upfrontCosts ?? "",
      paymentTerms: partner.paymentTerms ?? "",
      commissionStructure: partner.commissionStructure ?? "",
      minimumAccounts: partner.minimumAccounts?.toString() ?? "",
      minimumTotalBalance: partner.minimumTotalBalance?.toString() ?? "",
      avgAccountAgePref: partner.avgAccountAgePref ?? "",
      accountTypesAccepted: partner.accountTypesAccepted ?? "",
      collectionMethods: partner.collectionMethods ?? "",
      licensedStates: Array.isArray(partner.licensedStatesJson) ? (partner.licensedStatesJson as string[]).join(", ") : "",
      insuranceInfo: partner.insuranceInfo ?? "",
      yearsInBusiness: partner.yearsInBusiness?.toString() ?? "",
      complianceNotes: partner.complianceNotes ?? "",
    });
    setIsCreating(true);
  }

  function parseList(str: string): string[] {
    return str.split(",").map((s) => s.trim()).filter(Boolean);
  }

  function handleSave() {
    const data = {
      name: form.name,
      active: form.active,
      contactName: form.contactName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      website: form.website || undefined,
      statesServedJson: parseList(form.statesServed),
      industriesServedJson: parseList(form.industriesServed),
      specialtiesJson: parseList(form.specialties),
      preferredLeadTypesJson: parseList(form.preferredLeadTypes),
      minimumClaimSize: form.minimumClaimSize ? Number(form.minimumClaimSize) : null,
      maximumClaimSize: form.maximumClaimSize ? Number(form.maximumClaimSize) : null,
      exclusionsJson: parseList(form.exclusions),
      notes: form.notes || undefined,
      rankingPriority: form.rankingPriority,
      // Financial Terms
      contingencyRate: form.contingencyRate || undefined,
      upfrontCosts: form.upfrontCosts || undefined,
      paymentTerms: form.paymentTerms || undefined,
      commissionStructure: form.commissionStructure || undefined,
      // Account Requirements
      minimumAccounts: form.minimumAccounts ? Number(form.minimumAccounts) : null,
      minimumTotalBalance: form.minimumTotalBalance ? Number(form.minimumTotalBalance) : null,
      avgAccountAgePref: form.avgAccountAgePref || undefined,
      accountTypesAccepted: form.accountTypesAccepted || undefined,
      // Service Details
      collectionMethods: form.collectionMethods || undefined,
      licensedStatesJson: parseList(form.licensedStates),
      insuranceInfo: form.insuranceInfo || undefined,
      yearsInBusiness: form.yearsInBusiness ? Number(form.yearsInBusiness) : null,
      complianceNotes: form.complianceNotes || undefined,
    };

    startTransition(async () => {
      if (editing) {
        await updatePartner(editing.id, data);
      } else {
        await createPartner(data);
      }
      resetForm();
      window.location.reload();
    });
  }

  function handleDelete(id: string) {
    setConfirmState({
      action: () => {
        startTransition(async () => {
          await deletePartner(id);
          setPartners(partners.filter((p) => p.id !== id));
        });
      },
    });
  }

  const inputClass = "mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="space-y-4">
      {/* Partners List */}
      <div className="space-y-2">
        {partners.map((partner) => (
          <div
            key={partner.id}
            className={`rounded-lg border bg-card p-4 ${!partner.active ? "opacity-60" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{partner.name}</p>
                <p className="text-sm text-muted-foreground">
                  {partner.contactName && `${partner.contactName} · `}
                  {partner.email ?? "No email"} · Priority: {partner.rankingPriority}
                  {partner.contingencyRate && ` · ${partner.contingencyRate}`}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Array.isArray(partner.statesServedJson) &&
                    (partner.statesServedJson as string[]).map((s) => {
                      const cls = stateClassifications[s.toUpperCase()] ?? "unknown";
                      const colors = getStateColor(cls);
                      return (
                        <span key={s} className={`rounded px-1.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
                          {s}
                        </span>
                      );
                    })}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(partner)} className="p-1 hover:bg-muted rounded">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => handleDelete(partner.id)} className="p-1 hover:bg-muted rounded text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Form */}
      {isCreating ? (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <h3 className="font-semibold">
            {editing ? "Edit Partner" : "New Referral Partner"}
          </h3>

          {/* Section 1: Basic Info */}
          <h4 className="font-medium text-sm text-muted-foreground border-b pb-1">Basic Info</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Contact Name</label>
              <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Website</label>
              <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Ranking Priority</label>
              <input type="number" value={form.rankingPriority} onChange={(e) => setForm({ ...form, rankingPriority: Number(e.target.value) })} className={inputClass} />
            </div>
          </div>

          {/* Section 2: Service Area */}
          <h4 className="font-medium text-sm text-muted-foreground border-b pb-1 mt-6">Service Area</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">States Served (comma-separated)</label>
              <input value={form.statesServed} onChange={(e) => setForm({ ...form, statesServed: e.target.value })} placeholder="GA, AL, MS" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Industries (comma-separated)</label>
              <input value={form.industriesServed} onChange={(e) => setForm({ ...form, industriesServed: e.target.value })} placeholder="healthcare, retail" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Specialties (comma-separated)</label>
              <input value={form.specialties} onChange={(e) => setForm({ ...form, specialties: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Exclusions (comma-separated)</label>
              <input value={form.exclusions} onChange={(e) => setForm({ ...form, exclusions: e.target.value })} className={inputClass} />
            </div>
          </div>

          {/* Section 3: Account Requirements */}
          <h4 className="font-medium text-sm text-muted-foreground border-b pb-1 mt-6">Account Requirements</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Min Claim Size ($)</label>
              <input type="number" value={form.minimumClaimSize} onChange={(e) => setForm({ ...form, minimumClaimSize: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Max Claim Size ($)</label>
              <input type="number" value={form.maximumClaimSize} onChange={(e) => setForm({ ...form, maximumClaimSize: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Minimum # of Accounts</label>
              <input type="number" value={form.minimumAccounts} onChange={(e) => setForm({ ...form, minimumAccounts: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Minimum Total Balance ($)</label>
              <input type="number" value={form.minimumTotalBalance} onChange={(e) => setForm({ ...form, minimumTotalBalance: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Preferred Account Age</label>
              <input value={form.avgAccountAgePref} onChange={(e) => setForm({ ...form, avgAccountAgePref: e.target.value })} placeholder="60-180 days" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Account Types Accepted</label>
              <input value={form.accountTypesAccepted} onChange={(e) => setForm({ ...form, accountTypesAccepted: e.target.value })} placeholder="Commercial only" className={inputClass} />
            </div>
          </div>

          {/* Section 4: Financial Terms */}
          <h4 className="font-medium text-sm text-muted-foreground border-b pb-1 mt-6">Financial Terms</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Contingency Rate (%)</label>
              <input value={form.contingencyRate} onChange={(e) => setForm({ ...form, contingencyRate: e.target.value })} placeholder="25%" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Upfront Costs / Fees</label>
              <input value={form.upfrontCosts} onChange={(e) => setForm({ ...form, upfrontCosts: e.target.value })} placeholder="$25 per account" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Payment Terms</label>
              <input value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} placeholder="Net 30" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Commission / Revenue Share</label>
              <input value={form.commissionStructure} onChange={(e) => setForm({ ...form, commissionStructure: e.target.value })} className={inputClass} />
            </div>
          </div>

          {/* Section 5: Service Details */}
          <h4 className="font-medium text-sm text-muted-foreground border-b pb-1 mt-6">Service Details</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Collection Methods</label>
              <input value={form.collectionMethods} onChange={(e) => setForm({ ...form, collectionMethods: e.target.value })} placeholder="Letters, calls, skip tracing" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Licensed / Bonded States (comma-separated)</label>
              <input value={form.licensedStates} onChange={(e) => setForm({ ...form, licensedStates: e.target.value })} placeholder="FL, GA, AL" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Insurance / Bonding Info</label>
              <input value={form.insuranceInfo} onChange={(e) => setForm({ ...form, insuranceInfo: e.target.value })} placeholder="$2M E&O coverage" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Years in Business</label>
              <input type="number" value={form.yearsInBusiness} onChange={(e) => setForm({ ...form, yearsInBusiness: e.target.value })} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Compliance Notes</label>
              <textarea value={form.complianceNotes} onChange={(e) => setForm({ ...form, complianceNotes: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background p-3 text-sm min-h-[60px]" />
            </div>
          </div>

          {/* Section 6: Notes */}
          <h4 className="font-medium text-sm text-muted-foreground border-b pb-1 mt-6">Notes</h4>
          <div>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 w-full rounded-md border border-input bg-background p-3 text-sm min-h-[60px]"
            />
          </div>

          {/* Section 7: Status */}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Active
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending || !form.name}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {editing ? "Update Partner" : "Create Partner"}
            </button>
            <button onClick={resetForm} className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center"
        >
          <Plus className="h-4 w-4" />
          Add Referral Partner
        </button>
      )}

      <ConfirmDialog
        open={!!confirmState}
        title="Delete Partner"
        message="Are you sure you want to delete this referral partner? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { confirmState?.action(); setConfirmState(null); }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
