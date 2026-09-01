"use client";

import { useState } from "react";
import { updateSystemConfig } from "@/actions/config.actions";
import { sendTestConfirmationEmail } from "@/actions/email-test.actions";
import { toast } from "@/components/ui/use-toast";
import { DEFAULT_HOT_LEAD_CONDITIONS, type HotLeadConditions } from "@/lib/hot-lead";

interface EmailSettingsProps {
  initialDefaultSender: string;
  initialHighValueSender: string;
  initialConfirmationEnabled: boolean;
  initialHotConditions: HotLeadConditions;
}

const inputCls = "w-full h-9 rounded-md border border-input bg-card px-3 text-sm";

export function EmailSettings({
  initialDefaultSender,
  initialHighValueSender,
  initialConfirmationEnabled,
  initialHotConditions,
}: EmailSettingsProps) {
  const [defaultSender, setDefaultSender] = useState(initialDefaultSender);
  const [highValueSender, setHighValueSender] = useState(initialHighValueSender);
  const [confirmationEnabled, setConfirmationEnabled] = useState(initialConfirmationEnabled);
  const [minUnits, setMinUnits] = useState(String(initialHotConditions.minUnits));
  const [allGoodStates, setAllGoodStates] = useState(initialHotConditions.requireAllGoodStates);
  const [excludedRentals, setExcludedRentals] = useState(initialHotConditions.excludedRentalTypes.join(", "));
  const [debtKeywords, setDebtKeywords] = useState(initialHotConditions.requiredDebtKeywords.join(", "));
  const [ownershipKeywords, setOwnershipKeywords] = useState(initialHotConditions.ownershipKeywords.join(", "));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  async function sendTest(flavor: "standard" | "hot") {
    setTesting(true);
    try {
      const res = await sendTestConfirmationEmail(flavor);
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

  const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  async function save() {
    setSaving(true);
    try {
      const conditions: HotLeadConditions = {
        minUnits: parseInt(minUnits, 10) || DEFAULT_HOT_LEAD_CONDITIONS.minUnits,
        requireAllGoodStates: allGoodStates,
        excludedRentalTypes: splitList(excludedRentals),
        requiredDebtKeywords: splitList(debtKeywords),
        ownershipKeywords: splitList(ownershipKeywords),
      };
      await Promise.all([
        updateSystemConfig("email_sender_default", defaultSender.trim()),
        updateSystemConfig("email_sender_high_value", highValueSender.trim()),
        updateSystemConfig("lead_confirmation_enabled", confirmationEnabled),
        updateSystemConfig("hot_lead_conditions", conditions as unknown as Record<string, unknown>),
      ]);
      toast({ title: "Email settings saved", variant: "success" });
    } catch {
      toast({ title: "Failed to save email settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div>
        <h2 className="font-semibold">Lead Emails</h2>
        <p className="text-sm text-muted-foreground">
          Sender identities for automated lead-facing emails, and the conditions that make a lead
          &quot;high value&quot; (high-value leads get the personal sender and the call-within-24-hours promise).
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm space-y-1 block">
          <span className="font-medium">Default sender</span>
          <input value={defaultSender} onChange={(e) => setDefaultSender(e.target.value)} className={inputCls}
            placeholder="Advanced Collection Bureau <noreply@advancedcb.com>" />
        </label>
        <label className="text-sm space-y-1 block">
          <span className="font-medium">High-value sender</span>
          <input value={highValueSender} onChange={(e) => setHighValueSender(e.target.value)} className={inputCls}
            placeholder="Noah Albers <nalbers@advancedcb.com>" />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={confirmationEnabled} onChange={(e) => setConfirmationEnabled(e.target.checked)} className="h-4 w-4" />
        Send a confirmation email to leads when they complete the intake form
      </label>

      <div className="border-t pt-3">
        <h3 className="text-sm font-semibold mb-2">High-value (hot) lead conditions</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm space-y-1 block">
            <span className="font-medium">Minimum units</span>
            <input type="number" value={minUnits} onChange={(e) => setMinUnits(e.target.value)} className={inputCls} />
          </label>
          <label className="flex items-center gap-2 text-sm md:mt-6">
            <input type="checkbox" checked={allGoodStates} onChange={(e) => setAllGoodStates(e.target.checked)} className="h-4 w-4" />
            All states must be classified good
          </label>
          <label className="text-sm space-y-1 block">
            <span className="font-medium">Excluded rental types <span className="text-muted-foreground font-normal">(comma separated, substring match)</span></span>
            <input value={excludedRentals} onChange={(e) => setExcludedRentals(e.target.value)} className={inputCls} />
          </label>
          <label className="text-sm space-y-1 block">
            <span className="font-medium">Required debt keywords</span>
            <input value={debtKeywords} onChange={(e) => setDebtKeywords(e.target.value)} className={inputCls} />
          </label>
          <label className="text-sm space-y-1 block">
            <span className="font-medium">Ownership keywords</span>
            <input value={ownershipKeywords} onChange={(e) => setOwnershipKeywords(e.target.value)} className={inputCls} />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Email Settings"}
        </button>
        <button
          onClick={() => sendTest("standard")}
          disabled={testing}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Send me a test (standard)
        </button>
        <button
          onClick={() => sendTest("hot")}
          disabled={testing}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Send me a test (high value)
        </button>
      </div>
    </div>
  );
}
