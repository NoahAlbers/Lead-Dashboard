import { getCustomStatuses, getTierRanges } from "@/actions/status.actions";
import { getArchivedLeads } from "@/actions/lead.actions";
import { getEmailTypes } from "@/actions/email-type.actions";
import { getStateClassifications } from "@/actions/state-classification.actions";
import { getSlaConfigs, getOfficeHours, getHolidays } from "@/actions/sla.actions";
import { SettingsClient } from "./settings-client";
import { SlaSettings } from "@/components/admin/sla-settings";

export default async function SettingsPage() {
  const [statuses, archivedLeads, tierRanges, emailTypes, stateClassifications, slaConfigs, officeHours, holidays] = await Promise.all([
    getCustomStatuses("status"),
    getArchivedLeads(),
    getTierRanges(),
    getEmailTypes(),
    getStateClassifications(),
    getSlaConfigs(),
    getOfficeHours(),
    getHolidays(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          System configuration
        </p>
      </div>

      <SettingsClient
        statuses={statuses.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          isDefault: s.isDefault,
        }))}
        tiers={tierRanges}
        archivedLeads={archivedLeads.map((l) => ({
          id: l.id,
          fullName: l.fullName,
          companyName: l.companyName,
          email: l.email,
          createdAt: l.createdAt.toISOString(),
          score: l.score,
        }))}
        emailTypes={emailTypes.map((et) => ({
          id: et.id,
          name: et.name,
          color: et.color,
          isReferral: et.isReferral,
          isDefault: et.isDefault,
        }))}
        stateClassifications={stateClassifications.map((sc) => ({
          id: sc.id,
          stateAbbrev: sc.stateAbbrev,
          stateName: sc.stateName,
          classification: sc.classification,
          note: sc.note,
          active: sc.active,
        }))}
      />

      {/* SLA Configuration */}
      <div className="rounded-lg border bg-card p-5">
        <SlaSettings
          initialConfigs={slaConfigs.map((c) => ({
            id: c.id,
            qualityTier: c.qualityTier,
            firstContactMinutes: c.firstContactMinutes,
            followUpMinutes: c.followUpMinutes,
            escalationMinutes: c.escalationMinutes,
          }))}
          initialOfficeHours={{
            startTime: officeHours.startTime,
            endTime: officeHours.endTime,
            activeDays: officeHours.activeDays as number[],
            timezone: officeHours.timezone,
          }}
          initialHolidays={holidays.map((h) => ({
            id: h.id,
            date: h.date.toISOString(),
            name: h.name,
          }))}
          tierNames={tierRanges.map((t) => t.name)}
        />
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-6">
        {/* CRM Field Mapping */}
        <div>
          <h2 className="font-semibold mb-2">Act! CRM Field Mapping</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Default CSV export mappings for Act! CRM import:
          </p>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Act! Field</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Lead Field</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Company", "companyName"],
                  ["Contact", "fullName"],
                  ["First Name", "firstName"],
                  ["Last Name", "lastName"],
                  ["E-mail", "email"],
                  ["Phone", "phone"],
                  ["City", "city"],
                  ["State", "state"],
                  ["Zip", "zip"],
                  ["Industry", "industry"],
                  ["Lead Score", "score"],
                  ["Quality Tier", "qualityTier"],
                  ["Status", "status"],
                ].map(([actField, leadField]) => (
                  <tr key={actField} className="border-b last:border-0">
                    <td className="px-3 py-2">{actField}</td>
                    <td className="px-3 py-2 font-mono text-xs">{leadField}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Webhook Info */}
        <div>
          <h2 className="font-semibold mb-2">Intake Form Webhook</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Configure your form to POST submissions to:
          </p>
          <code className="block rounded-md bg-muted px-3 py-2 text-sm font-mono">
            POST /api/webhooks/intake-form
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            Include header: <code>x-webhook-secret: [your secret]</code>
          </p>
        </div>
      </div>
    </div>
  );
}
