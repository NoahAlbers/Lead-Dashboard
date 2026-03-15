"use client";

import { useState, useTransition, useEffect } from "react";
import { Plus, Trash2, Save, Download } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  upsertSlaConfig,
  updateOfficeHours,
  addHoliday,
  removeHoliday,
  importFederalHolidays,
} from "@/actions/sla.actions";

interface SlaConfigItem {
  id: string;
  qualityTier: string;
  firstContactMinutes: number;
  followUpMinutes: number;
  escalationMinutes: number | null;
}

interface OfficeHoursItem {
  startTime: string;
  endTime: string;
  activeDays: number[];
  timezone: string;
}

interface HolidayItem {
  id: string;
  date: string;
  name: string;
}

interface SlaSettingsProps {
  initialConfigs: SlaConfigItem[];
  initialOfficeHours: OfficeHoursItem;
  initialHolidays: HolidayItem[];
  tierNames: string[];
}

const DAY_LABELS = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
  { day: 7, label: "Sun" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

function minutesToLabel(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 8); // 8 business hours per day
  return `${d} biz days`;
}

export function SlaSettings({ initialConfigs, initialOfficeHours, initialHolidays, tierNames }: SlaSettingsProps) {
  const [isPending, startTransition] = useTransition();

  // SLA Configs
  const [configs, setConfigs] = useState<Record<string, { firstContact: number; followUp: number; escalation: number | null }>>(
    Object.fromEntries(
      tierNames.map((tier) => {
        const existing = initialConfigs.find((c) => c.qualityTier === tier);
        return [tier, {
          firstContact: existing?.firstContactMinutes ?? 240,
          followUp: existing?.followUpMinutes ?? 960,
          escalation: existing?.escalationMinutes ?? 1440,
        }];
      })
    )
  );

  // Office Hours
  const [officeHours, setOfficeHours] = useState(initialOfficeHours);

  // Holidays
  const [holidays, setHolidays] = useState(initialHolidays);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  function handleSaveSlaConfig(tier: string) {
    const c = configs[tier];
    if (!c) return;
    startTransition(async () => {
      await upsertSlaConfig(tier, {
        firstContactMinutes: c.firstContact,
        followUpMinutes: c.followUp,
        escalationMinutes: c.escalation,
      });
      toast({ title: `SLA config saved for ${tier}` });
    });
  }

  function handleSaveOfficeHours() {
    startTransition(async () => {
      await updateOfficeHours(officeHours);
      toast({ title: "Office hours updated" });
    });
  }

  function handleAddHoliday() {
    if (!newHolidayDate || !newHolidayName) return;
    startTransition(async () => {
      await addHoliday(newHolidayDate, newHolidayName);
      setHolidays([...holidays, { id: `new-${Date.now()}`, date: newHolidayDate, name: newHolidayName }]);
      setNewHolidayDate("");
      setNewHolidayName("");
      toast({ title: "Holiday added" });
    });
  }

  function handleRemoveHoliday(id: string) {
    startTransition(async () => {
      await removeHoliday(id);
      setHolidays(holidays.filter((h) => h.id !== id));
    });
  }

  function handleImportFederal() {
    const year = new Date().getFullYear();
    startTransition(async () => {
      await importFederalHolidays(year);
      toast({ title: `Imported US federal holidays for ${year}` });
      window.location.reload();
    });
  }

  const inputClass = "flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm";

  return (
    <div className="space-y-6">
      {/* SLA Thresholds per Tier */}
      <div>
        <h2 className="font-semibold mb-1">SLA Thresholds</h2>
        <p className="text-sm text-muted-foreground mb-3">Business minutes until SLA breach, per quality tier.</p>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tier</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">First Contact (min)</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Follow-Up (min)</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Escalation (min)</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {tierNames.map((tier) => {
                const c = configs[tier];
                if (!c) return null;
                return (
                  <tr key={tier} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{tier}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={c.firstContact}
                        onChange={(e) => setConfigs({ ...configs, [tier]: { ...c, firstContact: Number(e.target.value) } })}
                        className="w-24 rounded border border-input bg-card px-2 py-1 text-sm"
                      />
                      <span className="text-xs text-muted-foreground ml-1">({minutesToLabel(c.firstContact)})</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={c.followUp}
                        onChange={(e) => setConfigs({ ...configs, [tier]: { ...c, followUp: Number(e.target.value) } })}
                        className="w-24 rounded border border-input bg-card px-2 py-1 text-sm"
                      />
                      <span className="text-xs text-muted-foreground ml-1">({minutesToLabel(c.followUp)})</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={c.escalation ?? ""}
                        onChange={(e) => setConfigs({ ...configs, [tier]: { ...c, escalation: e.target.value ? Number(e.target.value) : null } })}
                        placeholder="None"
                        className="w-24 rounded border border-input bg-card px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleSaveSlaConfig(tier)}
                        disabled={isPending}
                        className="rounded p-1 text-primary hover:bg-primary/10 disabled:opacity-50"
                      >
                        <Save className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Office Hours */}
      <div>
        <h2 className="font-semibold mb-1">Office Hours</h2>
        <p className="text-sm text-muted-foreground mb-3">SLA clocks only tick during these hours.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Start Time</label>
            <input
              type="time"
              value={officeHours.startTime}
              onChange={(e) => setOfficeHours({ ...officeHours, startTime: e.target.value })}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className="text-sm font-medium">End Time</label>
            <input
              type="time"
              value={officeHours.endTime}
              onChange={(e) => setOfficeHours({ ...officeHours, endTime: e.target.value })}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Timezone</label>
            <select
              value={officeHours.timezone}
              onChange={(e) => setOfficeHours({ ...officeHours, timezone: e.target.value })}
              className={`mt-1 ${inputClass} font-[inherit]`}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace("America/", "").replace("Pacific/", "").replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className="text-sm font-medium">Active Days</label>
          <div className="flex gap-2 mt-1">
            {DAY_LABELS.map(({ day, label }) => (
              <button
                key={day}
                onClick={() => {
                  const days = officeHours.activeDays.includes(day)
                    ? officeHours.activeDays.filter((d) => d !== day)
                    : [...officeHours.activeDays, day].sort();
                  setOfficeHours({ ...officeHours, activeDays: days });
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  officeHours.activeDays.includes(day)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleSaveOfficeHours}
          disabled={isPending}
          className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Save Office Hours
        </button>
      </div>

      {/* Holidays */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold">Holidays</h2>
            <p className="text-sm text-muted-foreground">Excluded from SLA business time calculation.</p>
          </div>
          <button
            onClick={handleImportFederal}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Import US Federal Holidays
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            type="date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            className="rounded-md border border-input bg-card px-3 py-1.5 text-sm"
          />
          <input
            type="text"
            value={newHolidayName}
            onChange={(e) => setNewHolidayName(e.target.value)}
            placeholder="Holiday name..."
            className="flex-1 rounded-md border border-input bg-card px-3 py-1.5 text-sm"
          />
          <button
            onClick={handleAddHoliday}
            disabled={isPending || !newHolidayDate || !newHolidayName}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>

        {holidays.length > 0 ? (
          <div className="rounded-md border overflow-hidden max-h-[200px] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{h.date.slice(0, 10)}</td>
                    <td className="px-3 py-2">{h.name}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => handleRemoveHoliday(h.id)} disabled={isPending} className="rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No holidays configured.</p>
        )}
      </div>
    </div>
  );
}
