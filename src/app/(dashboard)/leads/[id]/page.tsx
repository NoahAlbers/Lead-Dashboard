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
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function TagList({ items }: { items: string }) {
  if (!items) return <span className="text-muted-foreground">—</span>;
  const tags = items.split(",").map(s => s.trim()).filter(Boolean);
  if (tags.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag, i) => (
        <span key={i} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
          {tag}
        </span>
      ))}
    </div>
  );
}

// Extract ACB-specific fields from the raw payload
function getIntakeFormFields(rawPayload: Record<string, unknown> | null) {
  if (!rawPayload) return null;

  // The raw payload could be the direct form data or nested
  const raw = (rawPayload._rawIntakeForm as Record<string, unknown>) ?? rawPayload;

  return {
    companyWebsite: raw.companyWebsite as string | undefined,
    noCompany: raw.noCompany as boolean | undefined,
    noWebsite: raw.noWebsite as boolean | undefined,
    priorAgency: raw.priorAgency as string | undefined,
    debtTypes: raw.debtTypes as string[] | undefined,
    customDebtType: raw.customDebtType as string | undefined,
    debtsNow: raw.debtsNow as string | undefined,
    states: raw.states as string[] | undefined,
    ownershipType: raw.ownershipType as string | undefined,
    ownPercent: raw.ownPercent as number | undefined,
    totalUnits: raw.totalUnits as string | undefined,
    rentalTypes: raw.rentalTypes as string[] | undefined,
    propertyTypes: raw.propertyTypes as string[] | undefined,
    avgRent: raw.avgRent as number | undefined,
    listingSites: raw.listingSites as string[] | undefined,
    customListing: raw.customListing as string | undefined,
    pmSoftware: raw.pmSoftware as string[] | undefined,
    customPM: raw.customPM as string | undefined,
    comments: raw.comments as string | undefined,
    certifyOwesDebt: raw.certifyOwesDebt as boolean | undefined,
    certifyNoDebt: raw.certifyNoDebt as boolean | undefined,
  };
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

  // Extract ACB intake form specific fields from raw payload
  const intakeFields = getIntakeFormFields(lead.rawPayloadJson as Record<string, unknown> | null);
  const isIntakeForm = lead.source === "intake_form" || !!intakeFields?.debtTypes;

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
          <SectionCard title="Contact Information">
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
              {intakeFields?.companyWebsite && (
                <InfoRow label="Website" value={intakeFields.companyWebsite} />
              )}
              {intakeFields?.noCompany && (
                <InfoRow label="Company Status" value="Independent owner" />
              )}
            </div>
          </SectionCard>

          {/* ACB Intake Form Details — only shown for intake form leads */}
          {isIntakeForm && intakeFields && (
            <SectionCard title="Intake Form Details">
              <div className="space-y-4">
                {/* Debt & Collection Info */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Debt & Collection Info
                  </p>
                  <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                    {intakeFields.debtTypes && intakeFields.debtTypes.length > 0 && (
                      <div className="py-1.5">
                        <p className="text-sm text-muted-foreground mb-1">Debt Types</p>
                        <TagList items={intakeFields.debtTypes.join(", ") + (intakeFields.customDebtType ? `, ${intakeFields.customDebtType}` : "")} />
                      </div>
                    )}
                    <InfoRow label="Debts Ready Now" value={intakeFields.debtsNow} />
                    <InfoRow label="Prior Collection Agency" value={intakeFields.priorAgency} />
                    {intakeFields.certifyOwesDebt && (
                      <InfoRow label="Certification" value="Tenants owe debt" />
                    )}
                    {intakeFields.certifyNoDebt && (
                      <InfoRow label="Certification" value="No debt owed" />
                    )}
                  </div>
                </div>

                {/* States Served */}
                {intakeFields.states && intakeFields.states.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Geographic Coverage
                    </p>
                    <TagList items={intakeFields.states.join(", ")} />
                  </div>
                )}

                {/* Property Details */}
                {(intakeFields.totalUnits || intakeFields.ownershipType || intakeFields.rentalTypes?.length) && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Property Portfolio
                    </p>
                    <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                      <InfoRow label="Ownership" value={
                        intakeFields.ownershipType
                          ? intakeFields.ownershipType + (
                              intakeFields.ownershipType === "We own and manage for others" && intakeFields.ownPercent != null
                                ? ` (${intakeFields.ownPercent}% own / ${100 - intakeFields.ownPercent}% manage)`
                                : ""
                            )
                          : undefined
                      } />
                      <InfoRow label="Total Units" value={intakeFields.totalUnits} />
                      <InfoRow label="Avg Rent / Unit" value={
                        intakeFields.avgRent
                          ? `$${intakeFields.avgRent.toLocaleString()}`
                          : undefined
                      } />
                      {intakeFields.rentalTypes && intakeFields.rentalTypes.length > 0 && (
                        <div className="py-1.5">
                          <p className="text-sm text-muted-foreground mb-1">Rental Types</p>
                          <TagList items={intakeFields.rentalTypes.join(", ")} />
                        </div>
                      )}
                      {intakeFields.propertyTypes && intakeFields.propertyTypes.length > 0 && (
                        <div className="py-1.5">
                          <p className="text-sm text-muted-foreground mb-1">Property Types</p>
                          <TagList items={intakeFields.propertyTypes.join(", ")} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Software & Listings */}
                {(intakeFields.listingSites?.length || intakeFields.pmSoftware?.length) && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Software & Listings
                    </p>
                    <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                      {intakeFields.listingSites && intakeFields.listingSites.length > 0 && (
                        <div className="py-1.5">
                          <p className="text-sm text-muted-foreground mb-1">Listing Sites</p>
                          <TagList items={intakeFields.listingSites.join(", ") + (intakeFields.customListing ? `, ${intakeFields.customListing}` : "")} />
                        </div>
                      )}
                      {intakeFields.pmSoftware && intakeFields.pmSoftware.length > 0 && (
                        <div className="py-1.5">
                          <p className="text-sm text-muted-foreground mb-1">PM Software</p>
                          <TagList items={intakeFields.pmSoftware.join(", ") + (intakeFields.customPM ? `, ${intakeFields.customPM}` : "")} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Comments */}
                {intakeFields.comments && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Comments / Questions
                    </p>
                    <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/50 p-3">
                      {intakeFields.comments}
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Generic Intake Summary — for non-intake-form leads or as fallback */}
          {!isIntakeForm && (
            <SectionCard title="Intake Summary">
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
            </SectionCard>
          )}

          {/* Quick Stats Row — for intake form leads */}
          {isIntakeForm && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {lead.balanceAmount && (
                <div className="rounded-lg border bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground">Est. Portfolio Value</p>
                  <p className="text-lg font-bold mt-1">${lead.balanceAmount.toLocaleString()}</p>
                </div>
              )}
              {intakeFields?.totalUnits && (
                <div className="rounded-lg border bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground">Total Units</p>
                  <p className="text-lg font-bold mt-1">{intakeFields.totalUnits}</p>
                </div>
              )}
              {intakeFields?.avgRent && (
                <div className="rounded-lg border bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground">Avg Rent</p>
                  <p className="text-lg font-bold mt-1">${intakeFields.avgRent.toLocaleString()}</p>
                </div>
              )}
              {intakeFields?.states && intakeFields.states.length > 0 && (
                <div className="rounded-lg border bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground">States</p>
                  <p className="text-lg font-bold mt-1">{intakeFields.states.length}</p>
                </div>
              )}
            </div>
          )}

          {/* Score Explanation */}
          <SectionCard title="Qualification">
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
          </SectionCard>

          {/* Referral Recommendation */}
          {referrals.length > 0 && (
            <SectionCard title="Referral Recommendation">
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
            </SectionCard>
          )}

          {/* Activity Timeline */}
          <SectionCard title="Activity Timeline">
            <ActivityTimeline events={events} />
          </SectionCard>

          {/* Notes */}
          <SectionCard title="Notes">
            <LeadNotes notes={notes} />
          </SectionCard>
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

            {/* Lead Metadata */}
            <div className="mt-4 pt-4 border-t">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                Source Info
              </h3>
              <div className="text-sm space-y-1">
                <InfoRow label="Source" value={lead.leadSource} />
                <InfoRow label="Urgency" value={lead.urgency} />
                {lead.utmSource && <InfoRow label="UTM Source" value={lead.utmSource} />}
                {lead.utmMedium && <InfoRow label="UTM Medium" value={lead.utmMedium} />}
                {lead.utmCampaign && <InfoRow label="UTM Campaign" value={lead.utmCampaign} />}
              </div>
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
