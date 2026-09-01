"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { updateSystemConfig } from "@/actions/config.actions";
import { sendTestConfirmationEmail } from "@/actions/email-test.actions";
import { toast } from "@/components/ui/use-toast";
import {
  CONDITION_FIELDS,
  OPS_BY_KIND,
  type FieldCondition,
  type HotLeadRules,
  type ConditionOp,
} from "@/lib/hot-lead";

interface EmailSettingsProps {
  initialDefaultSender: string;
  initialHighValueSender: string;
  initialConfirmationEnabled: boolean;
  initialHotConditions: HotLeadRules;
  initialIntakeFormUrl: string;
  initialRecaptureEnabled: boolean;
}

const inputCls = "h-9 rounded-md border border-input bg-card px-3 text-sm";

export function EmailSettings({
  initialDefaultSender,
  initialHighValueSender,
  initialConfirmationEnabled,
  initialHotConditions,
  initialIntakeFormUrl,
  initialRecaptureEnabled,
}: EmailSettingsProps) {
  const [defaultSender, setDefaultSender] = useState(initialDefaultSender);
  const [highValueSender, setHighValueSender] = useState(initialHighValueSender);
  const [intakeFormUrl, setIntakeFormUrl] = useState(initialIntakeFormUrl);
  const [confirmationEnabled, setConfirmationEnabled] = useState(initialConfirmationEnabled);
  const [recaptureEnabled, setRecaptureEnabled] = useState(initialRecaptureEnabled);
  const [conditions, setConditions] = useState<FieldCondition[]>(initialHotConditions.conditions);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testAddress, setTestAddress] = useState("");

  function fieldKind(fieldKey: string): "number" | "array" | "string" | "states" {
    return CONDITION_FIELDS.find((f) => f.key === fieldKey)?.kind ?? "string";
  }

  function updateCondition(i: number, patch: Partial<FieldCondition>) {
    setConditions((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function changeField(i: number, fieldKey: string) {
    const ops = OPS_BY_KIND[fieldKind(fieldKey)];
    updateCondition(i, { field: fieldKey, op: ops[0].op, value: "" });
  }

  async function save() {
    setSaving(true);
    try {
      const cleaned = conditions.filter(
        (c) => c.field && c.op && (c.op === "all_good_states" || (c.value ?? "").trim() !== "")
      );
      await Promise.all([
        updateSystemConfig("email_sender_default", defaultSender.trim()),
        updateSystemConfig("email_sender_high_value", highValueSender.trim()),
        updateSystemConfig("lead_confirmation_enabled", confirmationEnabled),
        updateSystemConfig("recapture_enabled", recaptureEnabled),
        updateSystemConfig("hot_lead_conditions", { conditions: cleaned } as unknown as Record<string, unknown>),
        updateSystemConfig("intake_form_url", intakeFormUrl.trim() || "https://www.advancedcb.com/"),
      ]);
      setConditions(cleaned);
      toast({ title: "Email settings saved", variant: "success" });
    } catch {
      toast({ title: "Failed to save email settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function sendTest(flavor: "standard" | "hot") {
    setTesting(true);
    try {
      const res = await sendTestConfirmationEmail(flavor, testAddress.trim() || undefined);
      if (res.success) {
        toast({ title: `Test email sent to ${res.to}`, variant: "success" });
      } else {
        toast({ title: `Test email failed: ${res.error ?? "unknown error"}`, variant: "destructive" });
      }
    } catch {
      toast({ title: "Test email failed", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5 space-y-5">
      <div>
        <h2 className="font-semibold">Lead Emails</h2>
        <p className="text-sm text-muted-foreground">
          Sender identities for automated lead-facing emails, and the rules that make a lead
          &quot;high value&quot;. High-value leads get the personal sender and the call-within-24-hours promise
          in their confirmation and recapture emails.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm space-y-1 block">
          <span className="font-medium">Default sender</span>
          <input value={defaultSender} onChange={(e) => setDefaultSender(e.target.value)} className={`${inputCls} w-full`}
            placeholder="Advanced Collection Bureau <noreply@advancedcb.com>" />
        </label>
        <label className="text-sm space-y-1 block">
          <span className="font-medium">High-value sender</span>
          <input value={highValueSender} onChange={(e) => setHighValueSender(e.target.value)} className={`${inputCls} w-full`}
            placeholder="Noah Albers <nalbers@advancedcb.com>" />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={confirmationEnabled} onChange={(e) => setConfirmationEnabled(e.target.checked)} className="h-4 w-4" />
        Send a confirmation email to leads when they complete the intake form
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={recaptureEnabled} onChange={(e) => setRecaptureEnabled(e.target.checked)} className="h-4 w-4" />
        <span>
          Send recapture emails to people who abandon the intake form
          <span className="block text-xs text-muted-foreground">Up to 3 emails over 3 days with a link to pick up where they left off. Unchecking stops new enrollments and pauses all pending sends.</span>
        </span>
      </label>

      <label className="text-sm space-y-1 block max-w-xl">
        <span className="font-medium">Intake form page URL</span>
        <span className="block text-xs text-muted-foreground">Resume and edit links in emails point here (the page with the form on it).</span>
        <input value={intakeFormUrl} onChange={(e) => setIntakeFormUrl(e.target.value)} className={`${inputCls} w-full`}
          placeholder="https://www.advancedcb.com/" />
      </label>

      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold">High-value lead rules</h3>
        <p className="text-xs text-muted-foreground mb-3">
          A lead is high value when every rule below matches. Rules can use any CRM or intake field.
        </p>
        <div className="space-y-2">
          {conditions.map((c, i) => {
            const kind = fieldKind(c.field);
            const ops = OPS_BY_KIND[kind];
            const needsValue = c.op !== "all_good_states";
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={c.field}
                  onChange={(e) => changeField(i, e.target.value)}
                  className={inputCls}
                >
                  {CONDITION_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
                <select
                  value={c.op}
                  onChange={(e) => updateCondition(i, { op: e.target.value as ConditionOp })}
                  className={inputCls}
                >
                  {ops.map((o) => (
                    <option key={o.op} value={o.op}>{o.label}</option>
                  ))}
                </select>
                {needsValue && (
                  <input
                    value={c.value ?? ""}
                    onChange={(e) => updateCondition(i, { value: e.target.value })}
                    placeholder={kind === "number" ? "500" : "value"}
                    className={`${inputCls} w-44`}
                  />
                )}
                <button
                  onClick={() => setConditions((prev) => prev.filter((_, idx) => idx !== i))}
                  className="rounded p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                  title="Remove rule"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => setConditions((prev) => [...prev, { field: "units", op: "gte", value: "" }])}
          className="mt-2 flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" />
          Add rule
        </button>
      </div>

      <div className="border-t pt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Email Settings"}
        </button>
        <input
          type="email"
          value={testAddress}
          onChange={(e) => setTestAddress(e.target.value)}
          placeholder="Test recipient (defaults to you)"
          className={`${inputCls} w-64`}
        />
        <button
          onClick={() => sendTest("standard")}
          disabled={testing}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Send test (standard)
        </button>
        <button
          onClick={() => sendTest("hot")}
          disabled={testing}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Send test (high value)
        </button>
      </div>
    </div>
  );
}
