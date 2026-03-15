"use client";

import { useState, useTransition } from "react";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { updateNotificationPreference, updateSoundPreferences } from "@/actions/preferences.actions";
import { toast } from "@/components/ui/use-toast";
import { useSoundManager } from "@/components/layout/sound-manager";

interface NotifPref {
  notificationType: string;
  browserPushEnabled: boolean;
  inAppEnabled: boolean;
  soundEnabled: boolean;
}

const TYPE_LABELS: Record<string, { label: string; description: string }> = {
  new_lead: { label: "New Lead", description: "When a new lead is submitted" },
  lead_assigned: { label: "Lead Assigned", description: "When a lead is assigned to you" },
  lead_reassigned: { label: "Lead Reassigned", description: "When a lead is reassigned" },
  sla_warning: { label: "SLA Warning", description: "When an SLA is approaching its threshold" },
  sla_breach: { label: "SLA Breach", description: "When an SLA threshold is exceeded" },
  sla_escalation: { label: "SLA Escalation", description: "When an SLA reaches escalation level" },
  follow_up_due: { label: "Follow-Up Due", description: "When a scheduled follow-up is due" },
  duplicate_detected: { label: "Duplicate Detected", description: "When a new lead is flagged as duplicate" },
};

interface NotificationSettingsProps {
  initialNotifPrefs: NotifPref[];
  initialSoundPrefs: { soundsEnabled: boolean; volume: number };
}

export function NotificationSettings({ initialNotifPrefs, initialSoundPrefs }: NotificationSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [prefs, setPrefs] = useState(initialNotifPrefs);
  const { soundsEnabled, volume, setSoundsEnabled, setVolume, playSound } = useSoundManager();

  function handleToggle(type: string, field: "inAppEnabled" | "soundEnabled", value: boolean) {
    setPrefs((prev) => prev.map((p) => (p.notificationType === type ? { ...p, [field]: value } : p)));
    startTransition(async () => {
      await updateNotificationPreference(type, { [field]: value });
    });
  }

  function handleSoundToggle(enabled: boolean) {
    setSoundsEnabled(enabled);
    startTransition(async () => {
      await updateSoundPreferences({ soundsEnabled: enabled });
    });
  }

  function handleVolumeChange(vol: number) {
    setVolume(vol);
    startTransition(async () => {
      await updateSoundPreferences({ volume: vol });
    });
  }

  function testSound() {
    playSound("normal");
  }

  return (
    <div className="space-y-6">
      {/* Sound Settings */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          {soundsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          Sound Settings
        </h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span className="text-sm">Enable notification sounds</span>
            <button
              onClick={() => handleSoundToggle(!soundsEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${soundsEnabled ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${soundsEnabled ? "translate-x-5" : ""}`} />
            </button>
          </label>

          {soundsEnabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Volume</span>
                <span className="text-xs text-muted-foreground">{volume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-full"
              />
              <button
                onClick={testSound}
                className="text-xs text-primary hover:underline"
              >
                Test Sound
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Per-Type Notification Preferences */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Notification Preferences
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Choose which notifications you receive and how.
        </p>

        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Notification</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground w-24">In-App</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground w-24">Sound</th>
              </tr>
            </thead>
            <tbody>
              {prefs.map((pref) => {
                const info = TYPE_LABELS[pref.notificationType];
                if (!info) return null;
                return (
                  <tr key={pref.notificationType} className="border-b last:border-0">
                    <td className="px-3 py-3">
                      <p className="font-medium">{info.label}</p>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={pref.inAppEnabled}
                        onChange={(e) => handleToggle(pref.notificationType, "inAppEnabled", e.target.checked)}
                        disabled={isPending}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={pref.soundEnabled}
                        onChange={(e) => handleToggle(pref.notificationType, "soundEnabled", e.target.checked)}
                        disabled={isPending || !soundsEnabled}
                        className="rounded border-gray-300"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
