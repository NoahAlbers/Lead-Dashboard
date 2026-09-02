"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  sendTestTemplateEmail,
} from "@/actions/template.actions";
import { Plus, Pencil, Trash2, Send, Copy, Eye } from "lucide-react";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  renderTemplate,
  type EmailLeadData,
  type EmailReferralPartner,
} from "@/lib/email-template-render";

// Sample lead used for the live preview and the "Send test to me" email.
const SAMPLE_LEAD: EmailLeadData = {
  id: "sample",
  email: "wise@investwisecap.com",
  fullName: "Chris Wise",
  firstName: "Chris",
  lastName: "Wise",
  companyName: "Wise Capital",
  title: "Owner",
  phone: "(502) 555-0142",
  city: "Louisville",
  state: "Kentucky",
  states: ["Kentucky"],
  country: "United States",
  industry: "Residential Property Management",
  debtType: "Residential Rental Debt",
  accountVolume: "20",
  balanceAmount: 48500,
  serviceRequested: "Contingency Collections",
  leadSource: "Website Intake Form",
  score: 72,
  qualityTier: "B",
  status: "new",
  createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
};

const SAMPLE_PARTNER: EmailReferralPartner = {
  id: "sample-partner",
  name: "Syncom",
  contactName: "Syncom Partner Desk",
  email: "partners@syncom.example",
  emails: ["partners@syncom.example"],
  phone: "(800) 555-0199",
  website: "https://syncom.example",
  contingencyRate: "30%",
  upfrontCosts: "None",
  minimumAccounts: 10,
  minimumTotalBalance: 25000,
};

const SAMPLE_ASSIGNED_USER = "Noah Albers";

const SAMPLE_LEAD_DATA_TABLE = `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
<tr><td style="padding:3px 14px 3px 0;color:#8889A0;">Name</td><td style="padding:3px 0;">Chris Wise</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#8889A0;">Company</td><td style="padding:3px 0;">Wise Capital</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#8889A0;">Email</td><td style="padding:3px 0;">wise@investwisecap.com</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#8889A0;">State</td><td style="padding:3px 0;">Kentucky</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#8889A0;">Units</td><td style="padding:3px 0;">20</td></tr>
</table>`;

const MERGE_VARIABLES: Array<{ group: string; keys: string[] }> = [
  { group: "Contact", keys: ["first_name", "last_name", "full_name", "company_name", "title", "email", "phone", "alternate_phone"] },
  { group: "Location", keys: ["address_1", "address_2", "city", "state", "zip", "country"] },
  { group: "Business", keys: ["industry", "debt_type", "balance_amount", "estimated_claim_value", "units", "service_requested", "notes_from_form", "urgency", "business_type", "geographic_scope"] },
  { group: "Metadata", keys: ["lead_source", "source_page", "utm_source", "utm_medium", "utm_campaign"] },
  { group: "System", keys: ["score", "quality_tier", "status", "assigned_user_name", "created_at", "lead_data_table"] },
  { group: "Referral Partner", keys: ["referral_partner_name", "referral_partner_contact_name", "referral_partner_email", "referral_partner_phone", "referral_partner_website", "referral_partner_contingency_rate", "referral_partner_upfront_costs", "referral_partner_minimum_accounts", "referral_partner_minimum_total_balance"] },
];

function renderSample(template: string): string {
  return renderTemplate(template, SAMPLE_LEAD, SAMPLE_ASSIGNED_USER, SAMPLE_PARTNER, {
    "{{lead_data_table}}": SAMPLE_LEAD_DATA_TABLE,
  });
}

interface Template {
  id: string;
  name: string;
  type: string;
  subjectTemplate: string;
  bodyTemplate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmailTypeItem {
  id: string;
  name: string;
  color: string;
  isReferral: boolean;
}

const FALLBACK_TYPES = [
  { value: "intro", label: "Intro Email" },
  { value: "referral", label: "Referral Email" },
  { value: "follow_up", label: "Follow-Up Email" },
  { value: "internal_handoff", label: "Internal Handoff" },
];

export function TemplatesManager({
  initialTemplates,
  emailTypes,
}: {
  initialTemplates: Template[];
  emailTypes?: EmailTypeItem[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [confirmState, setConfirmState] = useState<{ action: () => void } | null>(null);
  const [sendingTest, setSendingTest] = useState(false);

  const templateTypes = emailTypes && emailTypes.length > 0
    ? emailTypes.map((et) => ({ value: et.name.toLowerCase().replace(/\s+/g, "_"), label: et.name }))
    : FALLBACK_TYPES;

  const [form, setForm] = useState({
    name: "",
    type: "intro",
    subjectTemplate: "",
    bodyTemplate: "",
    active: true,
  });

  function resetForm() {
    setForm({
      name: "",
      type: "intro",
      subjectTemplate: "",
      bodyTemplate: "",
      active: true,
    });
    setEditing(null);
    setIsCreating(false);
  }

  function startEdit(tmpl: Template) {
    setEditing(tmpl);
    setForm({
      name: tmpl.name,
      type: tmpl.type,
      subjectTemplate: tmpl.subjectTemplate,
      bodyTemplate: tmpl.bodyTemplate,
      active: tmpl.active,
    });
    setIsCreating(true);
  }

  function handleSave() {
    startTransition(async () => {
      if (editing) {
        await updateTemplate(editing.id, form);
        toast({ title: "Template updated" });
      } else {
        await createTemplate(form);
        toast({ title: "Template created" });
      }
      resetForm();
      router.refresh();
    });
  }

  const preview = useMemo(
    () => ({
      subject: renderSample(form.subjectTemplate),
      body: renderSample(form.bodyTemplate),
    }),
    [form.subjectTemplate, form.bodyTemplate]
  );

  async function handleSendTest() {
    setSendingTest(true);
    try {
      const res = await sendTestTemplateEmail({ subject: preview.subject, html: preview.body });
      if (res.success) {
        toast({ title: `Test sent to ${res.to}`, variant: "success" });
      } else {
        toast({ title: `Test failed: ${res.error ?? "unknown error"}`, variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Test failed",
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  }

  async function copyVariable(key: string) {
    const text = `{{${key}}}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `Copied ${text}` });
    } catch {
      toast({ title: text, description: "Copy it from here and paste into the template." });
    }
  }

  function handleDelete(id: string) {
    setConfirmState({
      action: () => {
        startTransition(async () => {
          await deleteTemplate(id);
          setTemplates(templates.filter((t) => t.id !== id));
          toast({ title: "Template deleted" });
        });
      },
    });
  }

  const inputClass =
    "mt-1 flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm";

  return (
    <div className="space-y-4">
      {/* Template List */}
      <div className="space-y-2">
        {templates.map((tmpl) => (
          <div
            key={tmpl.id}
            className={`rounded-lg border bg-card p-4 ${!tmpl.active ? "opacity-60" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{tmpl.name}</p>
                  {(() => {
                    const et = emailTypes?.find((e) => e.name.toLowerCase().replace(/\s+/g, "_") === tmpl.type);
                    return (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={et ? { backgroundColor: et.color + "30", color: et.color } : undefined}
                      >
                        {tmpl.type.replace(/_/g, " ")}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Subject: {tmpl.subjectTemplate}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(tmpl)}
                  className="p-1 hover:bg-muted rounded"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(tmpl.id)}
                  className="p-1 hover:bg-muted rounded text-destructive"
                >
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
            {editing ? "Edit Template" : "New Template"}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className={`${inputClass} font-[inherit]`}
              >
                {templateTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-4 min-w-0">
              <div>
                <label className="text-sm font-medium">Subject *</label>
                <input
                  value={form.subjectTemplate}
                  onChange={(e) =>
                    setForm({ ...form, subjectTemplate: e.target.value })
                  }
                  className={inputClass}
                  placeholder="Use {{company_name}}, {{full_name}}, etc."
                />
              </div>

              <div>
                <label className="text-sm font-medium">Body *</label>
                <div className="mt-1">
                  <RichTextEditor
                    content={form.bodyTemplate}
                    onChange={(html) => setForm({ ...form, bodyTemplate: html })}
                    placeholder="Write your email template..."
                  />
                </div>
              </div>

              {/* Live preview */}
              <div className="rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    Preview
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sample lead: Chris Wise, Wise Capital, referred to Syncom
                  </p>
                </div>
                <div className="px-3 py-2 border-b text-sm">
                  <span className="text-muted-foreground">Subject: </span>
                  <span className="font-medium">
                    {preview.subject || <span className="text-muted-foreground">(empty)</span>}
                  </span>
                </div>
                <div className="p-3">
                  {preview.body ? (
                    <div
                      className="rounded-md border bg-card p-4 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
                      dangerouslySetInnerHTML={{ __html: preview.body }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Start writing to see the rendered email.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Merge variables */}
            <aside className="rounded-lg border bg-card p-3 lg:sticky lg:top-4 lg:self-start lg:max-h-[80vh] lg:overflow-y-auto">
              <p className="text-sm font-medium">Merge variables</p>
              <p className="text-xs text-muted-foreground mb-2">Click to copy, then paste into the subject or body.</p>
              <div className="space-y-3">
                {MERGE_VARIABLES.map((g) => (
                  <div key={g.group}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                      {g.group}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {g.keys.map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => copyVariable(k)}
                          className="inline-flex items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:bg-muted"
                          title={`Copy {{${k}}}`}
                        >
                          {`{{${k}}}`}
                          <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={
                isPending ||
                !form.name ||
                !form.subjectTemplate ||
                !form.bodyTemplate
              }
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {editing ? "Update Template" : "Create Template"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleSendTest}
              disabled={sendingTest || (!form.subjectTemplate && !form.bodyTemplate)}
              className="ml-auto flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              title="Emails the rendered preview to your address"
            >
              <Send className="h-3.5 w-3.5" />
              {sendingTest ? "Sending..." : "Send test to me"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center"
        >
          <Plus className="h-4 w-4" />
          Add Email Template
        </button>
      )}

      <ConfirmDialog
        open={!!confirmState}
        title="Delete Template"
        message="Are you sure you want to delete this template? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { confirmState?.action(); setConfirmState(null); }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
