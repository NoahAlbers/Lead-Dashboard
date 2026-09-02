"use client";

import { useState } from "react";
import { updateSystemConfig } from "@/actions/config.actions";
import { toast } from "@/components/ui/use-toast";
import { SettingsSaveBar } from "@/components/admin/settings-save-bar";

interface AbandonSettingsProps {
  initialRecaptureEnabled: boolean;
  initialTimeoutMinutes: number;
  initialMaxAgeDays: number;
  initialEmail2DelayHours: number;
  initialEmail3DelayHours: number;
  initialIgnoreBefore: string | null;
}

const inputCls = "h-9 rounded-md border border-input bg-card px-3 text-sm";

export function AbandonSettings({
  initialRecaptureEnabled,
  initialTimeoutMinutes,
  initialMaxAgeDays,
  initialEmail2DelayHours,
  initialEmail3DelayHours,
  initialIgnoreBefore,
}: AbandonSettingsProps) {
  const [recaptureEnabled, setRecaptureEnabled] = useState(initialRecaptureEnabled);
  const [timeoutMinutes, setTimeoutMinutes] = useState(String(initialTimeoutMinutes));
  const [maxAgeDays, setMaxAgeDays] = useState(String(initialMaxAgeDays));
  const [email2Delay, setEmail2Delay] = useState(String(initialEmail2DelayHours));
  const [email3Delay, setEmail3Delay] = useState(String(initialEmail3DelayHours));
  const [ignoreBefore, setIgnoreBefore] = useState(initialIgnoreBefore);
  const [saving, setSaving] = useState(false);

  const unsaved =
    recaptureEnabled !== initialRecaptureEnabled ||
    timeoutMinutes !== String(initialTimeoutMinutes) ||
    maxAgeDays !== String(initialMaxAgeDays) ||
    email2Delay !== String(initialEmail2DelayHours) ||
    email3Delay !== String(initialEmail3DelayHours);

  function numOr(value: string, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  async function save() {
    setSaving(true);
    try {
      await Promise.all([
        updateSystemConfig("recapture_enabled", recaptureEnabled),
        updateSystemConfig("partial_lead_timeout_minutes", numOr(timeoutMinutes, 60)),
        updateSystemConfig("recapture_max_abandon_age_days", numOr(maxAgeDays, 7)),
        updateSystemConfig("recapture_email2_delay_hours", numOr(email2Delay, 23)),
        updateSystemConfig("recapture_email3_delay_hours", numOr(email3Delay, 48)),
      ]);
      toast({ title: "Abandoned form settings saved", variant: "success" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function resetCutoff() {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await updateSystemConfig("recapture_ignore_before", now);
      setIgnoreBefore(now);
      toast({ title: "Cutoff set. Only sessions abandoned from now on can be emailed.", variant: "success" });
    } catch {
      toast({ title: "Failed to update cutoff", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5 space-y-5">
      <div>
        <h2 className="font-semibold">Abandoned Forms</h2>
        <p className="text-sm text-muted-foreground">
          What happens when someone starts the intake form and walks away: when the session counts
          as abandoned, and how the recapture email sequence behaves.
        </p>
      </div>

      <label className="text-sm space-y-1 block max-w-xs">
        <span className="font-medium">Abandon timeout (minutes)</span>
        <span className="block text-xs text-muted-foreground">
          A partial session with no activity for this long becomes an abandoned-form lead.
        </span>
        <input type="number" min={5} value={timeoutMinutes} onChange={(e) => setTimeoutMinutes(e.target.value)} className={`${inputCls} w-28`} />
      </label>

      <div className="border-t pt-4 space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={recaptureEnabled} onChange={(e) => setRecaptureEnabled(e.target.checked)} className="h-4 w-4" />
          <span>
            Send recapture emails to people who abandon the form
            <span className="block text-xs text-muted-foreground">
              Up to 3 emails with a link that resumes their saved answers. Unchecking stops new enrollments and pauses all pending sends.
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-3 max-w-2xl">
          <label className="text-sm space-y-1 block">
            <span className="font-medium">Max abandon age (days)</span>
            <span className="block text-xs text-muted-foreground">Older abandons are never emailed.</span>
            <input type="number" min={1} value={maxAgeDays} onChange={(e) => setMaxAgeDays(e.target.value)} className={`${inputCls} w-24`} />
          </label>
          <label className="text-sm space-y-1 block">
            <span className="font-medium">Email 2 delay (hours)</span>
            <span className="block text-xs text-muted-foreground">After email 1.</span>
            <input type="number" min={1} value={email2Delay} onChange={(e) => setEmail2Delay(e.target.value)} className={`${inputCls} w-24`} />
          </label>
          <label className="text-sm space-y-1 block">
            <span className="font-medium">Email 3 delay (hours)</span>
            <span className="block text-xs text-muted-foreground">After email 2.</span>
            <input type="number" min={1} value={email3Delay} onChange={(e) => setEmail3Delay(e.target.value)} className={`${inputCls} w-24`} />
          </label>
        </div>

        <div className="rounded-md border bg-muted/40 p-3 max-w-2xl">
          <p className="text-sm font-medium">Launch cutoff</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sessions abandoned before{" "}
            {ignoreBefore
              ? new Date(ignoreBefore).toLocaleString("en-US", { timeZone: "America/New_York" }) + " EST"
              : "the built-in launch date"}{" "}
            never receive recapture emails, regardless of the settings above. This is what keeps the
            historical backlog from ever being emailed.
          </p>
          <button
            onClick={resetCutoff}
            disabled={saving}
            className="mt-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            Move cutoff to right now
          </button>
        </div>
      </div>

      <SettingsSaveBar unsaved={unsaved}>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Abandon Settings"}
        </button>
      </SettingsSaveBar>
    </div>
  );
}
