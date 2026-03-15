import { notFound } from "next/navigation";
import Link from "next/link";
import { format, toZonedTime } from "date-fns-tz";
import { ArrowLeft, ChevronDown, ExternalLink } from "lucide-react";
import { getLead, markLeadAsRead } from "@/actions/lead.actions";
import { getLeadNotes } from "@/actions/note.actions";
import { getLeadEvents } from "@/services/activity-log.service";
import { evaluateReferral } from "@/services/referral.service";
import { getActivePartners } from "@/actions/partner.actions";
import { StatusBadge, TierBadge, ScoreBadge } from "@/components/shared/status-badge";
import { getStateClassificationMap } from "@/actions/state-classification.actions";
import { getTierColorMap } from "@/actions/status.actions";
import { getLeadSlaInfo } from "@/actions/sla.actions";
import { getStateColor } from "@/lib/state-colors";
import { SlaBadge, SlaProgressBar } from "@/components/leads/sla-badge";
import { LeadActions } from "@/components/leads/lead-actions";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { LeadNotes } from "@/components/leads/lead-notes";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const EST_TZ = "America/New_York";

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

function SectionCard({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-lg border bg-card group">
      <summary className="p-5 cursor-pointer flex items-center justify-between font-semibold">
        {title}
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5 -mt-2">
        {children}
      </div>
    </details>
  );
}

function TagList({ items, customItems, stateClassMap }: { items: string; customItems?: string; stateClassMap?: Record<string, string> }) {
  if (!items && !customItems) return <span className="text-muted-foreground">—</span>;
  const tags = items.split(",").map(s => s.trim()).filter(Boolean);
  const customTags = customItems ? customItems.split(",").map(s => s.trim()).filter(Boolean) : [];
  if (tags.length === 0 && customTags.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag, i) => {
        if (stateClassMap) {
          const cls = stateClassMap[tag.toUpperCase()] ?? "unknown";
          const colors = getStateColor(cls);
          return (
            <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
              {tag}
            </span>
          );
        }
        return (
          <span key={i} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
            {tag}
          </span>
        );
      })}
      {customTags.map((tag, i) => (
        <span key={`c-${i}`} className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium italic">
          {tag}
        </span>
      ))}
    </div>
  );
}

function getIntakeFormFields(rawPayload: Record<string, unknown> | null) {
  if (!rawPayload) return null;
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
    noQuestions: raw.noQuestions as boolean | undefined,
    certifyOwesDebt: raw.certifyOwesDebt as boolean | undefined,
    certifyNoDebt: raw.certifyNoDebt as boolean | undefined,
    // Tracking fields
    location: raw.location as string | undefined,
    device: raw.device as string | undefined,
    clarityRecording: (raw.clarityRecording ?? raw.clarity_recording ?? raw.clarityUrl) as string | undefined,
    timezone: (raw.timezone ?? raw.likelyTimezone) as string | undefined,
    submittedAt: raw.submittedAt as string | undefined,
  };
}

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();

  const [lead, notes, events, stateClassMap, tierColorMap, slaInfo] = await Promise.all([
    getLead(id),
    getLeadNotes(id),
    getLeadEvents(id),
    getStateClassificationMap(),
    getTierColorMap(),
    getLeadSlaInfo(id),
  ]);

  if (!lead) notFound();

  if (!lead.isRead) {
    await markLeadAsRead(id);
  }

  const activePartners = await getActivePartners();

  const allTemplates = await prisma.emailTemplate.findMany({
    where: { active: true },
    orderBy: { type: "asc" },
  });
  const serializedTemplates = allTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.type,
    subjectTemplate: t.subjectTemplate,
    bodyTemplate: t.bodyTemplate,
  }));

  const leadForReferral = await prisma.lead.findUnique({ where: { id } });
  const referrals = leadForReferral ? await evaluateReferral(leadForReferral) : [];

  const scoreReasons = (lead.scoreReasons ?? []) as Array<{
    ruleName: string;
    scoreAdjustment: number;
    reason: string;
  }>;

  const intakeFields = getIntakeFormFields(lead.rawPayloadJson as Record<string, unknown> | null);
  const isIntakeForm = lead.source === "intake_form" || !!intakeFields?.debtTypes;

  const displayStates = intakeFields?.states && intakeFields.states.length > 0
    ? intakeFields.states.join(", ")
    : lead.state;

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
            <TierBadge tier={lead.qualityTier} colorMap={tierColorMap} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Created {format(toZonedTime(new Date(lead.createdAt), EST_TZ), "MMMM d, yyyy 'at' h:mm a", { timeZone: EST_TZ })} EST
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
              {lead.qualityTier}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Section 1: Contact Information */}
          <SectionCard title="Contact Information">
            <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <InfoRow label="Contact Name" value={lead.fullName} />
              <InfoRow label="Company" value={lead.companyName} />
              {intakeFields?.noCompany && <InfoRow label="" value="(Independent Owner)" />}
              <InfoRow label="Email" value={lead.email} />
              <InfoRow label="Phone" value={lead.phone} />
              <InfoRow label="Alt. Phone" value={lead.alternatePhone} />
              {intakeFields?.companyWebsite && !intakeFields?.noWebsite ? (
                <div className="flex justify-between py-1.5 text-sm">
                  <span className="text-muted-foreground">Website</span>
                  <a
                    href={intakeFields.companyWebsite.startsWith("http") ? intakeFields.companyWebsite : `https://${intakeFields.companyWebsite}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline text-right max-w-[60%] truncate inline-flex items-center gap-1"
                  >
                    {intakeFields.companyWebsite}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              ) : intakeFields?.noWebsite ? (
                <InfoRow label="Website" value="(No website)" />
              ) : null}
              {displayStates && (
                <div className="py-1.5 sm:col-span-2">
                  <p className="text-sm text-muted-foreground mb-1">States</p>
                  <TagList items={displayStates} stateClassMap={stateClassMap} />
                </div>
              )}
            </div>
          </SectionCard>

          {/* Section 2: Portfolio Details (intake form only) */}
          {isIntakeForm && intakeFields && (intakeFields.totalUnits || intakeFields.avgRent || intakeFields.ownershipType || intakeFields.rentalTypes?.length || intakeFields.propertyTypes?.length || intakeFields.listingSites?.length || intakeFields.pmSoftware?.length) && (
            <SectionCard title="Portfolio Details">
              <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                <InfoRow label="Total Units" value={intakeFields.totalUnits} />
                <InfoRow label="Avg Rent / Unit" value={intakeFields.avgRent ? `$${intakeFields.avgRent.toLocaleString()}/mo` : undefined} />
                <InfoRow label="Ownership" value={
                  intakeFields.ownershipType
                    ? intakeFields.ownershipType + (
                        intakeFields.ownershipType === "We own and manage for others" && intakeFields.ownPercent != null
                          ? ` (${intakeFields.ownPercent}% own / ${100 - intakeFields.ownPercent}% manage)`
                          : ""
                      )
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
                {intakeFields.listingSites && intakeFields.listingSites.length > 0 && (
                  <div className="py-1.5">
                    <p className="text-sm text-muted-foreground mb-1">Listing Sites</p>
                    <TagList items={intakeFields.listingSites.join(", ")} customItems={intakeFields.customListing} />
                  </div>
                )}
                {intakeFields.pmSoftware && intakeFields.pmSoftware.length > 0 && (
                  <div className="py-1.5">
                    <p className="text-sm text-muted-foreground mb-1">PM Software</p>
                    <TagList items={intakeFields.pmSoftware.join(", ")} customItems={intakeFields.customPM} />
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* Section 3: Collections Readiness (intake form only) */}
          {isIntakeForm && intakeFields && (intakeFields.debtTypes?.length || intakeFields.debtsNow || intakeFields.priorAgency || intakeFields.comments) && (
            <SectionCard title="Collections Readiness">
              <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                {intakeFields.debtTypes && intakeFields.debtTypes.length > 0 && (
                  <div className="py-1.5 sm:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">Debt Types</p>
                    <TagList items={intakeFields.debtTypes.join(", ")} customItems={intakeFields.customDebtType} />
                  </div>
                )}
                <InfoRow label="Debts Ready Now" value={intakeFields.debtsNow} />
                <InfoRow label="Prior Agency Experience" value={intakeFields.priorAgency} />
              </div>
              {intakeFields.comments ? (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Comments</p>
                  <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/50 p-3">{intakeFields.comments}</p>
                </div>
              ) : intakeFields.noQuestions ? (
                <p className="text-sm text-muted-foreground italic mt-2">(No questions)</p>
              ) : null}
            </SectionCard>
          )}

          {/* Generic Intake Summary — for non-intake-form leads */}
          {!isIntakeForm && (
            <SectionCard title="Intake Summary">
              <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                <InfoRow label="Service Requested" value={lead.serviceRequested} />
                <InfoRow label="Debt Type" value={lead.debtType} />
                <InfoRow label="Balance Amount" value={lead.balanceAmount ? `$${lead.balanceAmount.toLocaleString()}` : null} />
                <InfoRow label="Estimated Claim" value={lead.estimatedClaimValue ? `$${lead.estimatedClaimValue.toLocaleString()}` : null} />
                <InfoRow label="Industry" value={lead.industry} />
                <InfoRow label="Business Type" value={lead.businessType} />
                <InfoRow label="Account Volume" value={lead.accountVolume} />
                <InfoRow label="Urgency" value={lead.urgency} />
              </div>
              {lead.notesFromForm && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Notes from Form</p>
                  <p className="text-sm whitespace-pre-wrap">{lead.notesFromForm}</p>
                </div>
              )}
            </SectionCard>
          )}

          {/* SLA Tracking */}
          {slaInfo && (
            <SectionCard title="SLA Tracking">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {slaInfo.slaType === "first_contact" ? "First Contact SLA" : "Follow-Up SLA"}
                    </p>
                    <SlaBadge slaStatus={slaInfo.slaStatus} remainingMinutes={slaInfo.remainingMinutes} />
                  </div>
                  <div className="flex-1">
                    <SlaProgressBar percentElapsed={slaInfo.percentElapsed} slaStatus={slaInfo.slaStatus} />
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">{slaInfo.elapsedMinutes}m elapsed</span>
                      <span className="text-[10px] text-muted-foreground">{slaInfo.thresholdMinutes}m threshold</span>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Section 4: Qualification */}
          <SectionCard title="Qualification">
            <div className="flex items-center gap-4 mb-4">
              <div>
                <span className="text-sm text-muted-foreground">Lead Score</span>
                <p className="text-2xl font-bold">
                  {lead.score ?? "—"}
                  {lead.qualityTier && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({lead.qualityTier})
                    </span>
                  )}
                </p>
              </div>
              {lead.recommendedAction && (
                <div className="ml-auto">
                  <span className="text-sm text-muted-foreground">Recommended Action</span>
                  <p className="text-sm font-semibold capitalize">{lead.recommendedAction.replace(/_/g, " ")}</p>
                </div>
              )}
            </div>
            {scoreReasons.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Applied Rules:</p>
                <div className="space-y-1">
                  {scoreReasons.map((rule, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1">
                      <span>{rule.reason}</span>
                      <span className={rule.scoreAdjustment >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                        {rule.scoreAdjustment >= 0 ? "+" : ""}{rule.scoreAdjustment}
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
                  <div key={rec.partner.id} className={`rounded-md border p-3 ${i === 0 ? "border-primary/50 bg-primary/5" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{i === 0 && "★ "}{rec.partner.name}</p>
                        <p className="text-sm text-muted-foreground">{rec.reason}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">Score: {rec.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Section 5: Activity Timeline */}
          <SectionCard title="Activity Timeline">
            <ActivityTimeline events={events} />
          </SectionCard>

          {/* Section 6: Notes */}
          <SectionCard title="Notes">
            <LeadNotes notes={notes} />
          </SectionCard>

          {/* Section 7: Tracking & Source */}
          <SectionCard title="Tracking & Source" defaultOpen={true}>
            <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <InfoRow label="Source" value={lead.source ?? lead.leadSource} />
              <InfoRow label="Source Page" value={lead.sourcePage} />
              <InfoRow label="Urgency" value={lead.urgency} />
              {intakeFields?.location && <InfoRow label="Location / IP" value={intakeFields.location} />}
              {intakeFields?.device && <InfoRow label="Device" value={intakeFields.device} />}
              {lead.utmSource && <InfoRow label="UTM Source" value={lead.utmSource} />}
              {lead.utmMedium && <InfoRow label="UTM Medium" value={lead.utmMedium} />}
              {lead.utmCampaign && <InfoRow label="UTM Campaign" value={lead.utmCampaign} />}
              {lead.referrer && <InfoRow label="Referrer" value={lead.referrer} />}
              {intakeFields?.timezone && <InfoRow label="Timezone" value={intakeFields.timezone} />}
              {intakeFields?.submittedAt && <InfoRow label="Submitted (EST)" value={intakeFields.submittedAt} />}
              {intakeFields?.clarityRecording && (
                <div className="flex justify-between py-1.5 text-sm sm:col-span-2">
                  <span className="text-muted-foreground">Clarity Recording</span>
                  <a
                    href={intakeFields.clarityRecording}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View Recording
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
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
              templates={serializedTemplates}
              leadData={{
                fullName: lead.fullName,
                companyName: lead.companyName,
                phone: lead.phone,
                state: lead.state,
                industry: lead.industry,
                notesFromForm: lead.notesFromForm,
              }}
              assignedUserName={session?.user.name ?? "ACB Team"}
              referralPartners={activePartners}
            />

            {/* Assignment */}
            <div className="mt-6 pt-4 border-t">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">Assignment</h3>
              {lead.assignedUser ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    {lead.assignedUser.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium">{lead.assignedUser.name}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Unassigned</p>
              )}
            </div>

            {/* CRM Status */}
            <div className="mt-6 pt-4 border-t">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">CRM Status</h3>
              <p className="text-sm">{lead.crmStatus ? lead.crmStatus.replace(/_/g, " ") : "Not exported"}</p>
              {lead.crmExternalId && <p className="text-xs text-muted-foreground mt-1">External ID: {lead.crmExternalId}</p>}
            </div>

            {/* Duplicate Info */}
            {(lead.duplicateOfLead || lead.duplicateLeads.length > 0) && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">Duplicate Info</h3>
                {lead.duplicateOfLead && (
                  <p className="text-sm">
                    Duplicate of{" "}
                    <Link href={`/leads/${lead.duplicateOfLead.id}`} className="text-primary hover:underline">
                      {lead.duplicateOfLead.companyName || lead.duplicateOfLead.fullName || lead.duplicateOfLead.id}
                    </Link>
                  </p>
                )}
                {lead.duplicateLeads.length > 0 && (
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground">{lead.duplicateLeads.length} duplicate(s):</p>
                    {lead.duplicateLeads.map((dup) => (
                      <Link key={dup.id} href={`/leads/${dup.id}`} className="block text-primary hover:underline">
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
