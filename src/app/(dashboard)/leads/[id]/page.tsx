import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { getLead } from "@/actions/lead.actions";
import { getLeadNotes } from "@/actions/note.actions";
import { getLeadEvents } from "@/services/activity-log.service";
import { evaluateReferral } from "@/services/referral.service";
import { getTemplatesByType } from "@/services/email-template.service";
import { buildMailtoLink } from "@/services/email-template.service";
import { StatusBadge, TierBadge, ScoreBadge } from "@/components/shared/status-badge";
import { LeadActions } from "@/components/leads/lead-actions";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { LeadNotes } from "@/components/leads/lead-notes";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

interface PageProps {
  params: Promise<{ id: string }>;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();

  const [lead, notes, events] = await Promise.all([
    getLead(id),
    getLeadNotes(id),
    getLeadEvents(id),
  ]);

  if (!lead) notFound();

  // Build mailto link from intro template
  let mailtoLink: string | undefined;
  const introTemplates = await getTemplatesByType("intro");
  if (introTemplates.length > 0 && lead.email) {
    const tmpl = introTemplates[0];
    const fullName = lead.fullName || `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "there";
    const subject = tmpl.subjectTemplate
      .replaceAll("{{company_name}}", lead.companyName ?? "")
      .replaceAll("{{full_name}}", fullName);
    const body = tmpl.bodyTemplate
      .replaceAll("{{full_name}}", fullName)
      .replaceAll("{{company_name}}", lead.companyName ?? "")
      .replaceAll("{{assigned_user_name}}", session?.user.name ?? "ACB Team");
    mailtoLink = buildMailtoLink(lead.email, subject, body);
  }

  // Get referral recommendations
  const leadForReferral = await prisma.lead.findUnique({ where: { id } });
  const referrals = leadForReferral ? await evaluateReferral(leadForReferral) : [];

  // Score reasons
  const scoreReasons = (lead.scoreReasons ?? []) as Array<{
    ruleName: string;
    scoreAdjustment: number;
    reason: string;
  }>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/leads"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Inbox
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {lead.companyName || lead.fullName || "Unknown Lead"}
            </h1>
            <StatusBadge status={lead.status} />
            <TierBadge tier={lead.qualityTier} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Created {format(new Date(lead.createdAt), "MMMM d, yyyy 'at' h:mm a")}
            {lead.assignedUser && (
              <> &middot; Assigned to {lead.assignedUser.name}</>
            )}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">
            <ScoreBadge score={lead.score} />
          </div>
          {lead.qualityTier && (
            <p className="text-sm text-muted-foreground mt-1">
              {lead.qualityTier} Lead
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <div className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold mb-3">Contact Information</h2>
            <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <InfoRow label="Contact Name" value={lead.fullName} />
              <InfoRow label="Company" value={lead.companyName} />
              <InfoRow label="Email" value={lead.email} />
              <InfoRow label="Phone" value={lead.phone} />
              <InfoRow label="Alt. Phone" value={lead.alternatePhone} />
              <InfoRow label="Title" value={lead.title} />
              <InfoRow label="State" value={lead.state} />
              <InfoRow
                label="Address"
                value={
                  [lead.address1, lead.address2, lead.city, lead.state, lead.zip]
                    .filter(Boolean)
                    .join(", ") || null
                }
              />
            </div>
          </div>

          {/* Intake Summary */}
          <div className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold mb-3">Intake Summary</h2>
            <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <InfoRow label="Service Requested" value={lead.serviceRequested} />
              <InfoRow label="Debt Type" value={lead.debtType} />
              <InfoRow
                label="Balance Amount"
                value={
                  lead.balanceAmount
                    ? `$${lead.balanceAmount.toLocaleString()}`
                    : null
                }
              />
              <InfoRow
                label="Estimated Claim"
                value={
                  lead.estimatedClaimValue
                    ? `$${lead.estimatedClaimValue.toLocaleString()}`
                    : null
                }
              />
              <InfoRow label="Industry" value={lead.industry} />
              <InfoRow label="Business Type" value={lead.businessType} />
              <InfoRow label="Account Volume" value={lead.accountVolume} />
              <InfoRow label="Urgency" value={lead.urgency} />
              <InfoRow label="Source" value={lead.leadSource} />
              <InfoRow label="Source Page" value={lead.sourcePage} />
            </div>
            {lead.notesFromForm && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm text-muted-foreground mb-1">Notes from Form</p>
                <p className="text-sm whitespace-pre-wrap">{lead.notesFromForm}</p>
              </div>
            )}
          </div>

          {/* Score Explanation */}
          <div className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold mb-3">Qualification</h2>
            <div className="flex items-center gap-4 mb-4">
              <div>
                <span className="text-sm text-muted-foreground">Lead Score</span>
                <p className="text-2xl font-bold">
                  {lead.score ?? "—"}
                  {lead.qualityTier && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({lead.qualityTier} Lead)
                    </span>
                  )}
                </p>
              </div>
              {lead.recommendedAction && (
                <div className="ml-auto">
                  <span className="text-sm text-muted-foreground">
                    Recommended Action
                  </span>
                  <p className="text-sm font-semibold capitalize">
                    {lead.recommendedAction.replace(/_/g, " ")}
                  </p>
                </div>
              )}
            </div>

            {scoreReasons.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Applied Rules:</p>
                <div className="space-y-1">
                  {scoreReasons.map((rule, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <span>{rule.reason}</span>
                      <span
                        className={
                          rule.scoreAdjustment >= 0
                            ? "text-emerald-600 font-medium"
                            : "text-red-600 font-medium"
                        }
                      >
                        {rule.scoreAdjustment >= 0 ? "+" : ""}
                        {rule.scoreAdjustment}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-sm py-1 border-t font-medium">
                    <span>Base Score</span>
                    <span>50</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Referral Recommendation */}
          {referrals.length > 0 && (
            <div className="rounded-lg border bg-card p-5">
              <h2 className="font-semibold mb-3">Referral Recommendation</h2>
              <div className="space-y-3">
                {referrals.slice(0, 3).map((rec, i) => (
                  <div
                    key={rec.partner.id}
                    className={`rounded-md border p-3 ${i === 0 ? "border-primary/50 bg-primary/5" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {i === 0 && "★ "}
                          {rec.partner.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {rec.reason}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Score: {rec.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold mb-3">Activity Timeline</h2>
            <ActivityTimeline events={events} />
          </div>

          {/* Notes */}
          <div className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold mb-3">Notes</h2>
            <LeadNotes notes={notes} />
          </div>
        </div>

        {/* Right Column - Actions */}
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-5 sticky top-6">
            <LeadActions
              leadId={lead.id}
              email={lead.email}
              phone={lead.phone}
              currentStatus={lead.status}
              mailtoLink={mailtoLink}
            />

            {/* CRM Status */}
            <div className="mt-6 pt-4 border-t">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                CRM Status
              </h3>
              <p className="text-sm">
                {lead.crmStatus
                  ? lead.crmStatus.replace(/_/g, " ")
                  : "Not exported"}
              </p>
              {lead.crmExternalId && (
                <p className="text-xs text-muted-foreground mt-1">
                  External ID: {lead.crmExternalId}
                </p>
              )}
            </div>

            {/* Duplicate Info */}
            {(lead.duplicateOfLead || lead.duplicateLeads.length > 0) && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                  Duplicate Info
                </h3>
                {lead.duplicateOfLead && (
                  <p className="text-sm">
                    Duplicate of{" "}
                    <Link
                      href={`/leads/${lead.duplicateOfLead.id}`}
                      className="text-primary hover:underline"
                    >
                      {lead.duplicateOfLead.companyName ||
                        lead.duplicateOfLead.fullName ||
                        lead.duplicateOfLead.id}
                    </Link>
                  </p>
                )}
                {lead.duplicateLeads.length > 0 && (
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground">
                      {lead.duplicateLeads.length} duplicate(s):
                    </p>
                    {lead.duplicateLeads.map((dup) => (
                      <Link
                        key={dup.id}
                        href={`/leads/${dup.id}`}
                        className="block text-primary hover:underline"
                      >
                        {dup.companyName || dup.fullName || dup.id}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
