import { notFound } from "next/navigation";
import Link from "next/link";
import { format, toZonedTime } from "date-fns-tz";
import { ChevronDown, ExternalLink } from "lucide-react";
import { getLead, markLeadAsRead } from "@/actions/lead.actions";
import { getLeadNotes } from "@/actions/note.actions";
import { getLeadEvents } from "@/services/activity-log.service";
import { evaluateReferral } from "@/services/referral.service";
import { getActivePartners } from "@/actions/partner.actions";
import { StatusBadge, TierBadge } from "@/components/shared/status-badge";
import { getStateClassificationMap } from "@/actions/state-classification.actions";
import { getTierColorMap } from "@/actions/status.actions";
import { getLeadSlaInfo } from "@/actions/sla.actions";
import { getOutcome } from "@/actions/outcome.actions";
import { getStateColor } from "@/lib/state-colors";
import { SlaBadge, SlaProgressBar } from "@/components/leads/sla-badge";
import { WorkingModeBarWrapper, DispositionPanelWrapper, SessionSummaryWrapper } from "@/components/leads/working-mode-wrapper";
import { MarkReadOnView } from "@/components/leads/mark-read-on-view";
import { LeadActions } from "@/components/leads/lead-actions";
import { BackToInboxLink } from "@/components/leads/back-to-inbox-link";
import { LeadEditDialog } from "@/components/leads/lead-edit-dialog";
import { RecapturePanel } from "@/components/leads/recapture-panel";
import { ResearchPanel } from "@/components/leads/research-panel";
import { ActivityTimeline } from "@/components/leads/activity-timeline";
import { ScoreCircle } from "@/components/leads/score-circle";
import { WonLostButtons } from "@/components/leads/won-lost-buttons";
import { leadWebDomain } from "@/lib/lead-domain";
import { phoneAreaLocation } from "@/lib/area-codes";
import { CopyButton } from "@/components/shared/copy-button";
import { FollowUpScheduler } from "@/components/leads/follow-up-scheduler";
import { OnboardingPanel } from "@/components/leads/onboarding-panel";
import { getLeadFollowUps } from "@/actions/follow-up.actions";
import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { LocalTime } from "@/components/shared/local-time";
import { EditableField } from "@/components/leads/editable-field";
import { ContactTabs } from "@/components/leads/contact-tabs";
import { US_STATE_NAMES } from "@/lib/state-labels";
import {
  PROPERTY_TYPE_OPTIONS,
  RENTAL_TYPE_OPTIONS,
  DEBT_TYPE_OPTIONS,
  LISTING_SITE_OPTIONS,
  PM_SOFTWARE_OPTIONS,
  OWNERSHIP_OPTIONS,
  DEBTS_NOW_OPTIONS,
  PRIOR_AGENCY_OPTIONS,
} from "@/lib/intake-options";

const EST_TZ = "America/New_York";

interface PageProps {
  params: Promise<{ id: string }>;
}


function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1 text-[13px]">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}

/**
 * A form answer stacked under its label, so an editor has room to open up
 * underneath without shoving the label around. Always drawn, even when empty,
 * because an unanswered question is exactly the one somebody wants to fill in.
 */
function IntakeRow({
  label,
  sub,
  className,
  children,
}: {
  label: string;
  sub?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`py-1 text-[13px] ${className ?? ""}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="font-medium">{children}</div>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

/** "45 min", "3h 20m", "2d 4h" for SLA labels. */
function fmtMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return hh ? `${d}d ${hh}h` : `${d}d`;
}

/** Label above, value below: long emails/URLs wrap instead of truncating. */
function ContactRow({
  label,
  value,
  sub,
  muted,
  alwaysShow,
  children,
}: {
  label: string;
  value?: string | null;
  sub?: string;
  muted?: boolean;
  /** Keep the row even with nothing in it, for fields you can fill in place. */
  alwaysShow?: boolean;
  children?: React.ReactNode;
}) {
  if (!children && !value && !alwaysShow) return null;
  return (
    <div className="py-1.5 text-[13px]">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className={`mt-0.5 break-words leading-snug ${muted ? "text-muted-foreground italic" : "font-medium"}`}>
        {children ?? value}
      </div>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function CompactCard({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-lg border bg-card group">
      <summary className="p-3 cursor-pointer flex items-center justify-between text-sm font-semibold">
        {title}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-3 pb-3 -mt-1">
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

  const [lead, notes, events, stateClassMap, tierColorMap, slaInfo, outcome, recapture, followUps, extraContacts] = await Promise.all([
    getLead(id),
    getLeadNotes(id),
    getLeadEvents(id),
    getStateClassificationMap(),
    getTierColorMap(),
    getLeadSlaInfo(id),
    getOutcome(id),
    prisma.recaptureEnrollment.findUnique({ where: { leadId: id } }),
    getLeadFollowUps(id),
    prisma.leadContact.findMany({ where: { leadId: id }, orderBy: { createdAt: "asc" } }),
  ]);

  if (!lead) {
    // Defense in depth: check if this lead is still being processed
    const pendingItem = await prisma.ingestionQueue.findFirst({
      where: {
        OR: [{ leadId: id }, { submissionId: id }],
        status: { in: ["received", "processing"] },
      },
    });

    if (pendingItem) {
      // Wait briefly and retry — lead should exist momentarily
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const retryLead = await getLead(id);
      if (!retryLead) notFound();
      // If retry succeeded, fall through — but we need to re-fetch everything
      // Simplest: just redirect to the same page which will re-run the whole fetch
      const { redirect } = await import("next/navigation");
      redirect(`/leads/${id}`);
    }

    notFound();
  }

  // markLeadAsRead moved to client-side MarkReadOnView component
  // (calling revalidatePath during server render crashes the page)

  const activePartners = await getActivePartners();

  // The tracked form session behind this lead, for the connection details the
  // intake payload does not carry (what kind of address they came in on).
  const formSession = await prisma.formSession.findFirst({
    where: { leadId: id },
    orderBy: { lastSeenAt: "desc" },
    select: { ipType: true, ipIsp: true, timezone: true, returnCount: true },
  });

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

  const tierHex = lead.qualityTier ? tierColorMap[lead.qualityTier] : undefined;
  const webDomain = leadWebDomain(intakeFields?.companyWebsite, lead.email);

  // Quiet duplicate check: same email, same phone digits, or same business
  // email domain on another open lead.
  const phoneDigits = lead.phone?.replace(/\D/g, "").slice(-10);
  const emailDomain = lead.email?.split("@")[1]?.toLowerCase();
  const businessDomain = emailDomain && leadWebDomain(null, lead.email) ? emailDomain : null;
  const possibleDuplicates = (lead.duplicateOfLead || lead.duplicateLeads.length > 0)
    ? []
    : await prisma.lead.findMany({
        where: {
          id: { not: lead.id },
          status: { notIn: ["ARCHIVED", "MERGED", "DUPLICATE"] },
          OR: [
            ...(lead.email ? [{ email: { equals: lead.email, mode: "insensitive" as const } }] : []),
            ...(phoneDigits && phoneDigits.length === 10 ? [{ phone: { contains: phoneDigits.slice(0, 3) + "-" + phoneDigits.slice(3, 6) } }, { phone: { contains: phoneDigits } }] : []),
            ...(businessDomain ? [{ email: { endsWith: `@${businessDomain}`, mode: "insensitive" as const } }] : []),
          ],
        },
        select: { id: true, fullName: true, companyName: true, email: true, status: true, createdAt: true },
        take: 3,
      });

  // Onboarding handoff: the latest portal created for this lead plus the
  // milestones the onboarding tool has reported back since.
  const onboardingCreated = events.find((e) => e.eventType === "onboarding_profile_created");
  const onboardingData = onboardingCreated?.eventDataJson as { portalUrl?: string; emailed?: boolean } | null | undefined;
  const onboardingMilestones = onboardingCreated
    ? events
        .filter((e) => e.eventType === "onboarding_milestone" && e.createdAt >= onboardingCreated.createdAt)
        .map((e) => {
          const d = e.eventDataJson as { milestone?: string; label?: string; at?: string } | null;
          return { milestone: d?.milestone ?? "", label: d?.label ?? "", at: d?.at ?? e.createdAt.toISOString() };
        })
    : [];

  // Most recent auto-research findings, so the panel shows them on load.
  const latestAutoResearch = (() => {
    const evt = events.find((e) => e.eventType === "auto_research");
    if (!evt) return null;
    const d = evt.eventDataJson as {
      domain?: string;
      siteTitle?: string | null;
      siteDescription?: string | null;
      profiles?: Array<{ kind: string; url: string }>;
      fetchedAt?: string;
      address?: string | null;
      lat?: number | null;
      lng?: number | null;
      geoPrecision?: "address" | "area" | null;
      addressFrom?: string | null;
      logoUrl?: string | null;
      logoSource?: string | null;
    } | null;
    return d ?? null;
  })();

  // The mark beside their name. Research finds a real square logo on most
  // sites, an apple touch icon or a manifest icon rather than the 32 pixel
  // favicon a lookup service would stretch for us; the service is the fallback
  // for sites that publish nothing.
  const companyMark =
    latestAutoResearch?.logoUrl ??
    (webDomain
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(webDomain)}&sz=128`
      : null);

  return (
    <div className="space-y-3">
      <MarkReadOnView leadId={lead.id} isRead={lead.isRead ?? false} />
      {/* Working Mode Bar */}
      <WorkingModeBarWrapper />
      <SessionSummaryWrapper />

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <BackToInboxLink />
          <div className="flex items-center gap-3 mt-1">
            {companyMark ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={companyMark}
                alt=""
                title={webDomain ?? undefined}
                className="h-14 w-14 rounded-xl border bg-card object-contain p-1.5 shadow-sm shrink-0"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-muted text-xl font-bold text-muted-foreground">
                {(lead.companyName || lead.fullName || "?").charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight truncate">
                {lead.fullName || "Unknown"}{lead.companyName ? ` | ${lead.companyName}` : ""}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Created {format(toZonedTime(new Date(lead.createdAt), EST_TZ), "MMMM d, yyyy 'at' h:mm a", { timeZone: EST_TZ })} EST
                {lead.assignedUser && (
                  <> &middot; Assigned to {lead.assignedUser.name}</>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:shrink-0 lg:flex-nowrap">
          {/* Info first: score, tier, status, SLA */}
          <ScoreCircle score={lead.score} tierColor={tierHex} />
          <div className="flex flex-col items-end gap-1">
            <TierBadge tier={lead.qualityTier} colorMap={tierColorMap} />
            <StatusBadge status={lead.status} />
            {slaInfo && slaInfo.slaStatus !== "paused" && (
              <SlaBadge slaStatus={slaInfo.slaStatus} remainingMinutes={slaInfo.remainingMinutes} compact />
            )}
          </div>
          <div className="h-10 w-px bg-border" />
          <LeadEditDialog
            lead={{
              id: lead.id,
              fullName: lead.fullName,
              firstName: lead.firstName,
              lastName: lead.lastName,
              companyName: lead.companyName,
              email: lead.email,
              phone: lead.phone,
              alternatePhone: lead.alternatePhone,
              title: lead.title,
              address1: lead.address1,
              city: lead.city,
              state: lead.state,
              zip: lead.zip,
              industry: lead.industry,
              debtType: lead.debtType,
              businessType: lead.businessType,
              accountVolume: lead.accountVolume,
              urgency: lead.urgency,
              notesFromForm: lead.notesFromForm,
            }}
          />
          <WonLostButtons
            leadId={lead.id}
            currentStatus={lead.status}
            referralPartners={activePartners.map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>
      </div>

      {possibleDuplicates.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="font-medium">Possibly the same person as</span>
          {possibleDuplicates.map((d) => (
            <Link key={d.id} href={`/leads/${d.id}`} className="underline underline-offset-2 hover:text-amber-700">
              {d.companyName || d.fullName || d.email || d.id}
              <span className="ml-1 text-xs text-amber-700/80">({d.status.replace(/_/g, " ").toLowerCase()})</span>
            </Link>
          ))}
          <Link href={`/leads/merge?leadA=${lead.id}&leadB=${possibleDuplicates[0].id}`} className="ml-auto rounded-md border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium hover:bg-amber-100">
            Compare and merge
          </Link>
        </div>
      )}

      {/* 3-Column Grid */}
      <div className="grid grid-cols-12 gap-3">

        {/* ===== LEFT COLUMN (4 cols) — Lead Data ===== */}
        <div className="col-span-12 lg:col-span-4 space-y-2">

          {/* Contact Information */}
          <CompactCard title="Contact Information">
            <ContactTabs
              leadId={lead.id}
              primaryLabel={lead.fullName ?? "Primary"}
              contacts={extraContacts.map((c) => ({
                id: c.id,
                name: c.name,
                title: c.title,
                email: c.email,
                phone: c.phone,
                alternatePhone: c.alternatePhone,
                notes: c.notes,
              }))}
            >
            <div className="divide-y divide-border/60">
              <ContactRow label="Name" alwaysShow>
                <EditableField
                  leadId={lead.id}
                  field="fullName"
                  target="lead"
                  value={lead.fullName}
                  copyValue={lead.fullName}
                  copyLabel="name"
                  placeholder="Their name"
                />
              </ContactRow>
              <ContactRow
                label="Company"
                sub={lead.companyName && intakeFields?.noCompany ? "Independent owner" : undefined}
                alwaysShow
              >
                <EditableField
                  leadId={lead.id}
                  field="companyName"
                  target="lead"
                  value={lead.companyName}
                  copyValue={lead.companyName}
                  copyLabel="company name"
                  placeholder="Company name"
                  emptyLabel={intakeFields?.noCompany ? "Independent owner" : "Not given"}
                />
              </ContactRow>
              <ContactRow label="Email" alwaysShow>
                <EditableField
                  leadId={lead.id}
                  field="email"
                  target="lead"
                  value={lead.email}
                  copyValue={lead.email}
                  copyLabel="email"
                  placeholder="name@company.com"
                  display={
                    lead.email ? (
                      <a href={`mailto:${lead.email}`} className="font-medium text-primary hover:underline break-all">
                        {lead.email}
                      </a>
                    ) : undefined
                  }
                />
              </ContactRow>
              <ContactRow label="Phone" sub={lead.phone ? phoneAreaLocation(lead.phone) ?? undefined : undefined} alwaysShow>
                <EditableField
                  leadId={lead.id}
                  field="phone"
                  target="lead"
                  value={lead.phone}
                  copyValue={lead.phone}
                  copyLabel="phone"
                  placeholder="(555) 555-5555"
                  display={
                    lead.phone ? (
                      <a href={`tel:${lead.phone}`} className="font-medium text-primary hover:underline">
                        {lead.phone}
                      </a>
                    ) : undefined
                  }
                />
              </ContactRow>
              <ContactRow
                label="Alt. Phone"
                sub={lead.alternatePhone ? phoneAreaLocation(lead.alternatePhone) ?? undefined : undefined}
                alwaysShow
              >
                <EditableField
                  leadId={lead.id}
                  field="alternatePhone"
                  target="lead"
                  value={lead.alternatePhone}
                  copyValue={lead.alternatePhone}
                  copyLabel="alternate phone"
                  placeholder="(555) 555-5555"
                  display={
                    lead.alternatePhone ? (
                      <a href={`tel:${lead.alternatePhone}`} className="font-medium text-primary hover:underline">
                        {lead.alternatePhone}
                      </a>
                    ) : undefined
                  }
                />
              </ContactRow>
              <ContactRow label="Website" alwaysShow>
                <EditableField
                  leadId={lead.id}
                  field="companyWebsite"
                  target="intake"
                  value={intakeFields?.companyWebsite}
                  copyValue={intakeFields?.companyWebsite}
                  copyLabel="website"
                  placeholder="company.com"
                  emptyLabel={intakeFields?.noWebsite ? "No website" : "Not given"}
                  display={
                    intakeFields?.companyWebsite ? (
                      <a
                        href={intakeFields.companyWebsite.startsWith("http") ? intakeFields.companyWebsite : `https://${intakeFields.companyWebsite}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline break-all inline-flex items-center gap-1"
                      >
                        {intakeFields.companyWebsite.replace(/^https?:\/\/(www\.)?/, "")}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : undefined
                  }
                />
              </ContactRow>
              <ContactRow label="States" alwaysShow>
                <EditableField
                  leadId={lead.id}
                  field="states"
                  target="intake"
                  kind="multiselect"
                  options={US_STATE_NAMES}
                  value={intakeFields?.states ?? (displayStates ? displayStates.split(",").map((x) => x.trim()) : [])}
                  emptyLabel="None given"
                  display={displayStates ? <TagList items={displayStates} stateClassMap={stateClassMap} /> : undefined}
                />
              </ContactRow>
            </div>
            </ContactTabs>
          </CompactCard>

          {/* Portfolio Details (intake form only) */}
          {isIntakeForm && intakeFields && (
            <CompactCard title="Portfolio Details">
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <IntakeRow label="Total Units">
                  <EditableField
                    leadId={lead.id}
                    field="totalUnits"
                    target="intake"
                    value={intakeFields.totalUnits}
                    placeholder="How many units"
                  />
                </IntakeRow>
                <InfoRow label="Avg Rent / Unit" value={intakeFields.avgRent ? `$${intakeFields.avgRent.toLocaleString()}/mo` : undefined} />
                <IntakeRow
                  label="Ownership"
                  sub={
                    intakeFields.ownershipType === "We own and manage for others" && intakeFields.ownPercent != null
                      ? `${intakeFields.ownPercent}% own / ${100 - intakeFields.ownPercent}% manage`
                      : undefined
                  }
                >
                  <EditableField
                    leadId={lead.id}
                    field="ownershipType"
                    target="intake"
                    kind="select"
                    options={OWNERSHIP_OPTIONS}
                    value={intakeFields.ownershipType}
                  />
                </IntakeRow>
                <IntakeRow label="Rental Types">
                  <EditableField
                    leadId={lead.id}
                    field="rentalTypes"
                    target="intake"
                    kind="multiselect"
                    options={RENTAL_TYPE_OPTIONS}
                    value={intakeFields.rentalTypes ?? []}
                    display={intakeFields.rentalTypes?.length ? <TagList items={intakeFields.rentalTypes.join(", ")} /> : undefined}
                  />
                </IntakeRow>
                <IntakeRow label="Property Types">
                  <EditableField
                    leadId={lead.id}
                    field="propertyTypes"
                    target="intake"
                    kind="multiselect"
                    options={PROPERTY_TYPE_OPTIONS}
                    value={intakeFields.propertyTypes ?? []}
                    display={intakeFields.propertyTypes?.length ? <TagList items={intakeFields.propertyTypes.join(", ")} /> : undefined}
                  />
                </IntakeRow>
                <IntakeRow label="Listing Sites">
                  <EditableField
                    leadId={lead.id}
                    field="listingSites"
                    target="intake"
                    kind="multiselect"
                    options={LISTING_SITE_OPTIONS}
                    value={intakeFields.listingSites ?? []}
                    display={
                      intakeFields.listingSites?.length
                        ? <TagList items={intakeFields.listingSites.join(", ")} customItems={intakeFields.customListing} />
                        : undefined
                    }
                  />
                </IntakeRow>
                <IntakeRow label="PM Software">
                  <EditableField
                    leadId={lead.id}
                    field="pmSoftware"
                    target="intake"
                    kind="multiselect"
                    options={PM_SOFTWARE_OPTIONS}
                    value={intakeFields.pmSoftware ?? []}
                    display={
                      intakeFields.pmSoftware?.length
                        ? <TagList items={intakeFields.pmSoftware.join(", ")} customItems={intakeFields.customPM} />
                        : undefined
                    }
                  />
                </IntakeRow>
              </div>
            </CompactCard>
          )}

          {/* Collections Readiness (intake form only) */}
          {isIntakeForm && intakeFields && (
            <CompactCard title="Collections Readiness">
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <IntakeRow label="Debt Types" className="sm:col-span-2">
                  <EditableField
                    leadId={lead.id}
                    field="debtTypes"
                    target="intake"
                    kind="multiselect"
                    options={DEBT_TYPE_OPTIONS}
                    value={intakeFields.debtTypes ?? []}
                    display={
                      intakeFields.debtTypes?.length
                        ? <TagList items={intakeFields.debtTypes.join(", ")} customItems={intakeFields.customDebtType} />
                        : undefined
                    }
                  />
                </IntakeRow>
                <IntakeRow label="Debts Ready Now">
                  <EditableField
                    leadId={lead.id}
                    field="debtsNow"
                    target="intake"
                    kind="select"
                    options={DEBTS_NOW_OPTIONS}
                    value={intakeFields.debtsNow}
                  />
                </IntakeRow>
                <IntakeRow label="Prior Agency Experience">
                  <EditableField
                    leadId={lead.id}
                    field="priorAgency"
                    target="intake"
                    kind="select"
                    options={PRIOR_AGENCY_OPTIONS}
                    value={intakeFields.priorAgency}
                  />
                </IntakeRow>
              </div>
              {intakeFields.comments ? (
                <div className="mt-2 pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Comments</p>
                  <p className="text-xs whitespace-pre-wrap rounded-md bg-muted/50 p-2">{intakeFields.comments}</p>
                </div>
              ) : intakeFields.noQuestions ? (
                <p className="text-xs text-muted-foreground italic mt-1">(No questions)</p>
              ) : null}
            </CompactCard>
          )}

          {/* Generic Intake Summary — for non-intake-form leads */}
          {!isIntakeForm && (
            <CompactCard title="Intake Summary">
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
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
                <div className="mt-2 pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Notes from Form</p>
                  <p className="text-xs whitespace-pre-wrap">{lead.notesFromForm}</p>
                </div>
              )}
            </CompactCard>
          )}

          {/* Tracking & Source */}
          <CompactCard title="Tracking & Source" defaultOpen={true}>
            <div className="divide-y divide-border/60">
              <ContactRow label="Source" value={lead.source ?? lead.leadSource} />
              {lead.formVariants && Object.keys(lead.formVariants as object).length > 0 && (
                <ContactRow label="Form variant" value={Object.entries(lead.formVariants as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join(", ")} />
              )}
              <ContactRow label="Urgency" value={lead.urgency} />
              <ContactRow label="Location / IP" alwaysShow>
                {intakeFields?.location ? (
                  <span className="group inline-flex items-center max-w-full">
                    <span className="min-w-0 break-words">{intakeFields.location}</span>
                    {/* Copy the address itself when there is one in there; a
                        rep pasting into a lookup wants the IP, not the city. */}
                    <CopyButton
                      value={intakeFields.location.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b|\b[0-9a-f:]{6,}\b/i)?.[0] ?? intakeFields.location}
                      label="IP"
                    />
                  </span>
                ) : (
                  <span className="italic text-muted-foreground">Not captured</span>
                )}
              </ContactRow>
              <ContactRow label="IP type" value={formSession?.ipType ?? "Not checked"} muted={!formSession?.ipType} />
              {(intakeFields?.timezone || formSession?.timezone) ? (
                <ContactRow label="Their time">
                  <LocalTime timezone={formSession?.timezone ?? intakeFields?.timezone ?? null} />
                </ContactRow>
              ) : (
                <ContactRow label="Their time" value="Not captured" muted />
              )}
              {formSession && formSession.returnCount > 0 && (
                <ContactRow
                  label="Returns"
                  value={`Came back ${formSession.returnCount === 1 ? "once" : `${formSession.returnCount} times`} while filling the form`}
                />
              )}
              <ContactRow label="Device" value={intakeFields?.device} />
              <ContactRow label="Referrer" value={lead.referrer} />
              <ContactRow label="UTM Source" value={lead.utmSource} />
              <ContactRow label="UTM Medium" value={lead.utmMedium} />
              <ContactRow label="UTM Campaign" value={lead.utmCampaign} />
              <ContactRow label="Submitted (EST)" value={intakeFields?.submittedAt} />
              {intakeFields?.clarityRecording && (
                <ContactRow label="Clarity Recording">
                  <a
                    href={intakeFields.clarityRecording}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View Recording
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </ContactRow>
              )}
            </div>
          </CompactCard>

          {/* Qualification */}
          <CompactCard title="Qualification">
            <div className="flex items-center gap-3 mb-3">
              <div>
                <span className="text-xs text-muted-foreground">Lead Score</span>
                <p className="text-lg font-bold leading-tight">
                  {lead.score ?? "—"}
                  {lead.qualityTier && (
                    <span className="text-xs font-normal text-muted-foreground ml-1.5">
                      ({lead.qualityTier})
                    </span>
                  )}
                </p>
              </div>
              {lead.recommendedAction && (
                <div className="ml-auto text-right">
                  <span className="text-xs text-muted-foreground">Recommended</span>
                  <p className="text-xs font-semibold capitalize">{lead.recommendedAction.replace(/_/g, " ")}</p>
                </div>
              )}
            </div>
            {scoreReasons.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5">Applied Rules:</p>
                <div className="space-y-0.5">
                  {scoreReasons.map((rule, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-muted-foreground">{rule.reason}</span>
                      <span className={rule.scoreAdjustment >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                        {rule.scoreAdjustment >= 0 ? "+" : ""}{rule.scoreAdjustment}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-xs py-0.5 border-t font-medium">
                    <span>Base Score</span>
                    <span>50</span>
                  </div>
                </div>
              </div>
            )}
          </CompactCard>
        </div>

        {/* ===== CENTER COLUMN (5 cols) — Timeline + SLA ===== */}
        <div className="col-span-12 lg:col-span-5 space-y-2">

          {/* Activity Timeline (merged events + notes) */}
          <CompactCard title="Activity Timeline">
            <ActivityTimeline
              events={events}
              notes={notes}
              leadId={lead.id}
              stateClassMap={stateClassMap}
              currentUserId={session?.user.id ?? null}
              isAdmin={session?.user.role === "ADMIN"}
            />
          </CompactCard>

          {/* Research: auto findings + quick links */}
          <ResearchPanel
            leadId={lead.id}
            companyName={lead.companyName}
            fullName={lead.fullName}
            firstName={lead.firstName}
            lastName={lead.lastName}
            state={lead.state}
            city={lead.city}
            companyWebsite={intakeFields?.companyWebsite}
            hasResearchLog={events.some((e) => e.eventType === "research_completed")}
            initialAutoResearch={latestAutoResearch}
          />

          {/* SLA Tracking */}
          {slaInfo && (
            <CompactCard title="SLA Tracking">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {slaInfo.slaType === "first_contact" ? "First Contact SLA" : "Follow-Up SLA"}
                    </p>
                    <SlaBadge slaStatus={slaInfo.slaStatus} remainingMinutes={slaInfo.remainingMinutes} />
                  </div>
                  <div className="flex-1">
                    <SlaProgressBar percentElapsed={slaInfo.percentElapsed} slaStatus={slaInfo.slaStatus} />
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{fmtMinutes(slaInfo.elapsedMinutes)} elapsed</span>
                      <span className="text-[10px] text-muted-foreground">{fmtMinutes(slaInfo.thresholdMinutes)} threshold</span>
                    </div>
                  </div>
                </div>
              </div>
            </CompactCard>
          )}

          {/* Referral Recommendation */}
          {referrals.length > 0 && (
            <CompactCard title="Referral Recommendation">
              <div className="space-y-2">
                {referrals.slice(0, 3).map((rec, i) => (
                  <div key={rec.partner.id} className={`rounded-md border p-2 ${i === 0 ? "border-primary/50 bg-primary/5" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{i === 0 && "★ "}{rec.partner.name}</p>
                        <p className="text-xs text-muted-foreground">{rec.reason}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Score: {rec.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CompactCard>
          )}

          {/* Referral Outcome */}
          {outcome && outcome.outcomeType === "referred_out" && (
            <CompactCard title="Referral Outcome">
              <div className="space-y-1">
                {outcome.referralPartner && (
                  <InfoRow label="Referred to" value={outcome.referralPartner.name} />
                )}
                {outcome.estimatedValue != null && (
                  <InfoRow label="Estimated Value" value={`$${Number(outcome.estimatedValue).toLocaleString()}`} />
                )}
                {outcome.reason && (
                  <InfoRow label="Reason" value={outcome.reason} />
                )}
                {outcome.notes && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-xs whitespace-pre-wrap rounded-md bg-muted/50 p-2">{outcome.notes}</p>
                  </div>
                )}
              </div>
            </CompactCard>
          )}

          {/* Disposition Panel (Working Mode) */}
          <DispositionPanelWrapper
            leadId={lead.id}
            leadLabel={lead.companyName || lead.fullName || "Lead"}
          />
        </div>

        {/* ===== RIGHT COLUMN (3 cols) — Actions, sticky ===== */}
        <div className="col-span-12 lg:col-span-3">
          <div className="sticky top-6 space-y-3">
            {/* Onboarding progress (once a portal exists) */}
            {onboardingCreated && onboardingData?.portalUrl && (
              <OnboardingPanel
                portalUrl={onboardingData.portalUrl}
                emailed={!!onboardingData.emailed}
                createdAt={onboardingCreated.createdAt.toISOString()}
                milestones={onboardingMilestones}
              />
            )}


            {/* Scheduled follow-ups */}
            <FollowUpScheduler
              leadId={lead.id}
              reminders={followUps.map((r) => ({
                id: r.id,
                reminderAt: r.reminderAt.toISOString(),
                note: r.note,
                completed: r.completed,
                notifiedAt: r.notifiedAt?.toISOString() ?? null,
                user: r.user,
              }))}
            />

            <div className="rounded-lg border bg-card p-3">
              <LeadActions
                leadId={lead.id}
                email={lead.email}
                phone={lead.phone}
                currentStatus={lead.status}
                templates={serializedTemplates}
                leadData={{
                  fullName: lead.fullName,
                  firstName: lead.firstName,
                  lastName: lead.lastName,
                  companyName: lead.companyName,
                  phone: lead.phone,
                  state: lead.state,
                  states: (lead.states as string[] | null) ?? null,
                  industry: lead.industry,
                  debtType: lead.debtType,
                  businessType: lead.businessType,
                  accountVolume: lead.accountVolume,
                  title: lead.title,
                  notesFromForm: lead.notesFromForm,
                  rawIntakeForm:
                    ((lead.rawPayloadJson as Record<string, unknown> | null)?._rawIntakeForm as Record<string, unknown>) ??
                    (lead.rawPayloadJson as Record<string, unknown> | null) ??
                    null,
                }}
                assignedUserName={session?.user.name ?? "ACB Team"}
                referralPartners={activePartners}
                onboardingPortalUrl={onboardingData?.portalUrl ?? null}
                logoUrl={companyMark}
                logoDomain={webDomain}
              />
            </div>

            {/* Recapture campaign status (abandoned-form leads) */}
            {recapture && (
              <RecapturePanel
                leadId={lead.id}
                enrollment={{
                  status: recapture.status,
                  stopReason: recapture.stopReason,
                  currentStep: recapture.currentStep,
                  nextSendAt: recapture.nextSendAt?.toISOString() ?? null,
                  lastSentAt: recapture.lastSentAt?.toISOString() ?? null,
                  abandonedStep: recapture.abandonedStep,
                }}
              />
            )}

            {/* Assignment */}
            <div className="rounded-lg border bg-card p-3">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">Assignment</h3>
              {lead.assignedUser ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                    {lead.assignedUser.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium text-sm">{lead.assignedUser.name}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Unassigned</p>
              )}
            </div>

            {/* CRM Status */}
            <div className="rounded-lg border bg-card p-3">
              <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">CRM Status</h3>
              <p className="text-sm">{lead.crmStatus ? lead.crmStatus.replace(/_/g, " ") : "Not exported"}</p>
              {lead.crmExternalId && <p className="text-[10px] text-muted-foreground mt-0.5">External ID: {lead.crmExternalId}</p>}
            </div>

            {/* Duplicate Info */}
            {(lead.duplicateOfLead || lead.duplicateLeads.length > 0) && (
              <div className="rounded-lg border bg-card p-3">
                <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">Duplicate Info</h3>
                {lead.duplicateOfLead && (
                  <div className="mb-2">
                    <Link
                      href={`/leads/merge?leadA=${lead.id}&leadB=${lead.duplicateOfLead.id}`}
                      className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-1 text-xs font-medium hover:bg-primary/20 transition-colors mb-1"
                    >
                      Merge with Original
                    </Link>
                  </div>
                )}
                {lead.duplicateOfLead && (
                  <p className="text-sm">
                    Duplicate of{" "}
                    <Link href={`/leads/${lead.duplicateOfLead.id}`} className="text-primary hover:underline">
                      {lead.duplicateOfLead.companyName || lead.duplicateOfLead.fullName || lead.duplicateOfLead.id}
                    </Link>
                  </p>
                )}
                {lead.duplicateLeads.length > 0 && (
                  <div className="text-sm space-y-0.5">
                    <p className="text-muted-foreground text-xs">{lead.duplicateLeads.length} duplicate(s):</p>
                    {lead.duplicateLeads.map((dup) => (
                      <Link key={dup.id} href={`/leads/${dup.id}`} className="block text-primary hover:underline text-sm">
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
