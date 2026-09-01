import { getCustomStatuses, getTierRanges } from "@/actions/status.actions";
import { getArchivedLeads } from "@/actions/lead.actions";
import { getEmailTypes } from "@/actions/email-type.actions";
import { getStateClassifications } from "@/actions/state-classification.actions";
import { getSlaConfigs, getOfficeHours, getHolidays } from "@/actions/sla.actions";
import { getSystemConfig } from "@/actions/config.actions";
import { getOutcomeReasonConfigs } from "@/actions/outcome.actions";
import { getIngestionStats } from "@/actions/ingestion.actions";
import { auth } from "@/lib/auth";
import { SettingsClient } from "./settings-client";
import { SlaSettings } from "@/components/admin/sla-settings";
import { AgingThresholdSettings } from "@/components/admin/aging-threshold-settings";
import { OutcomeReasonSettings } from "@/components/admin/outcome-reason-settings";
import { IngestionHealthDashboard } from "@/components/admin/ingestion-health";
import { FieldMappingSettings } from "@/components/admin/field-mapping-settings";
import { RecalculateScoresButton } from "@/components/admin/recalculate-scores-button";
import { EmailSettings } from "@/components/admin/email-settings";
import { AbandonSettings } from "@/components/admin/abandon-settings";
import { parseHotLeadConditions } from "@/lib/hot-lead";
import { BackfillSubmissionDataButton } from "@/components/admin/backfill-submission-data-button";

export default async function SettingsPage() {
  const [statuses, archivedLeads, tierRanges, emailTypes, stateClassifications, slaConfigs, officeHours, holidays, agingThresholdsRaw, outcomeReasonConfigs, ingestionStats, fieldMapping, session, senderDefault, senderHighValue, confirmationEnabledRaw, hotConditionsRaw, intakeFormUrlRaw, recaptureEnabledRaw, partialTimeoutRaw, maxAgeDaysRaw, email2DelayRaw, email3DelayRaw, ignoreBeforeRaw] = await Promise.all([
    getCustomStatuses("status"),
    getArchivedLeads(),
    getTierRanges(),
    getEmailTypes(),
    getStateClassifications(),
    getSlaConfigs(),
    getOfficeHours(),
    getHolidays(),
    getSystemConfig("aging_thresholds"),
    getOutcomeReasonConfigs(),
    getIngestionStats().catch(() => null),
    getSystemConfig("field_mapping"),
    auth(),
    getSystemConfig("email_sender_default"),
    getSystemConfig("email_sender_high_value"),
    getSystemConfig("lead_confirmation_enabled"),
    getSystemConfig("hot_lead_conditions"),
    getSystemConfig("intake_form_url"),
    getSystemConfig("recapture_enabled"),
    getSystemConfig("partial_lead_timeout_minutes"),
    getSystemConfig("recapture_max_abandon_age_days"),
    getSystemConfig("recapture_email2_delay_hours"),
    getSystemConfig("recapture_email3_delay_hours"),
    getSystemConfig("recapture_ignore_before"),
  ]);

  const agingThresholds = (agingThresholdsRaw as { green: number; yellow: number; orange: number; red: number } | null) ?? { green: 2, yellow: 4, orange: 6, red: 7 };
  const hotConditions = parseHotLeadConditions(hotConditionsRaw);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          System configuration
        </p>
      </div>

      <section id="general" className="scroll-mt-20">
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
      </section>

      {/* SLA Configuration */}
      <section id="sla" className="scroll-mt-20 rounded-lg border bg-card p-5">
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
      </section>

      {/* Lead Aging Thresholds */}
      <section id="aging" className="scroll-mt-20 rounded-lg border bg-card p-5">
        <AgingThresholdSettings initialThresholds={agingThresholds} />
      </section>

      {/* Lead Emails (senders, confirmation, high-value rules) */}
      <section id="emails" className="scroll-mt-20">
        <EmailSettings
          initialDefaultSender={(senderDefault as string) ?? "Advanced Collection Bureau <noreply@advancedcb.com>"}
          initialHighValueSender={(senderHighValue as string) ?? "Noah Albers <nalbers@advancedcb.com>"}
          initialConfirmationEnabled={confirmationEnabledRaw !== false}
          initialHotConditions={hotConditions}
          initialIntakeFormUrl={(intakeFormUrlRaw as string) ?? "https://www.advancedcb.com/"}
        />
      </section>

      {/* Abandoned Forms (timeout + recapture sequence) */}
      <section id="abandons" className="scroll-mt-20">
        <AbandonSettings
          initialRecaptureEnabled={recaptureEnabledRaw !== false}
          initialTimeoutMinutes={Number(partialTimeoutRaw) > 0 ? Number(partialTimeoutRaw) : 60}
          initialMaxAgeDays={Number(maxAgeDaysRaw) > 0 ? Number(maxAgeDaysRaw) : 7}
          initialEmail2DelayHours={Number(email2DelayRaw) > 0 ? Number(email2DelayRaw) : 23}
          initialEmail3DelayHours={Number(email3DelayRaw) > 0 ? Number(email3DelayRaw) : 48}
          initialIgnoreBefore={typeof ignoreBeforeRaw === "string" ? ignoreBeforeRaw : null}
        />
      </section>

      {/* Outcome Reasons */}
      <section id="outcomes" className="scroll-mt-20 rounded-lg border bg-card p-5">
        <OutcomeReasonSettings
          initialConfigs={outcomeReasonConfigs.map((c) => ({
            id: c.id,
            outcomeType: c.outcomeType,
            reasonText: c.reasonText,
            sortOrder: c.sortOrder,
            active: c.active,
          }))}
        />
      </section>

      {/* Ingestion Field Mapping */}
      <section id="field-mapping" className="scroll-mt-20 rounded-lg border bg-card p-5">
        <FieldMappingSettings initialMapping={fieldMapping as Record<string, string> ?? {}} />
      </section>

      {/* Ingestion Health Monitoring */}
      {ingestionStats && (
        <section id="ingestion" className="scroll-mt-20 rounded-lg border bg-card p-5">
          <IngestionHealthDashboard
            initialStats={ingestionStats}
            isAdmin={session?.user.role === "ADMIN"}
          />
        </section>
      )}

      {/* Data tools */}
      <section id="data-tools" className="scroll-mt-20 space-y-6">
        <div className="rounded-lg border bg-card p-5">
          <RecalculateScoresButton />
        </div>
        <div className="rounded-lg border bg-card p-5">
          <BackfillSubmissionDataButton />
        </div>
      </section>

      <section id="integrations" className="scroll-mt-20 rounded-lg border bg-card p-5 space-y-6">
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
      </section>
    </div>
  );
}
