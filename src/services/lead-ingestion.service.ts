import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { scoreAndUpdateLead } from "./scoring.service";
import { findDuplicates } from "./duplicate-detection.service";
import { evaluateReferral } from "./referral.service";
import { logEvent } from "./activity-log.service";
import { createNotificationsForRole } from "./notification.service";
interface WebflowFormData {
  [key: string]: unknown;
}

// Map Webflow form field names to our lead fields
// Adjust these mappings based on actual Webflow form field names
const FIELD_MAP: Record<string, string> = {
  "name": "fullName",
  "full-name": "fullName",
  "full_name": "fullName",
  "first-name": "firstName",
  "first_name": "firstName",
  "last-name": "lastName",
  "last_name": "lastName",
  "company": "companyName",
  "company-name": "companyName",
  "company_name": "companyName",
  "email": "email",
  "email-address": "email",
  "phone": "phone",
  "phone-number": "phone",
  "phone_number": "phone",
  "alternate-phone": "alternatePhone",
  "title": "title",
  "job-title": "title",
  "address": "address1",
  "address-1": "address1",
  "address-2": "address2",
  "city": "city",
  "state": "state",
  "zip": "zip",
  "zip-code": "zip",
  "country": "country",
  "industry": "industry",
  "debt-type": "debtType",
  "debt_type": "debtType",
  "balance": "balanceAmount",
  "balance-amount": "balanceAmount",
  "balance_amount": "balanceAmount",
  "estimated-claim-value": "estimatedClaimValue",
  "account-volume": "accountVolume",
  "service-requested": "serviceRequested",
  "service_requested": "serviceRequested",
  "services": "serviceRequested",
  "message": "notesFromForm",
  "notes": "notesFromForm",
  "comments": "notesFromForm",
  "urgency": "urgency",
  "business-type": "businessType",
  "states_array": "statesArray",
};

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase().replace(/^mailto:/, "");
}

/** 10/11-digit North American numbers become 321-555-0100; anything else is trimmed. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length === 10) return `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
  return raw.trim();
}

/** Collapse whitespace, strip stray trailing punctuation, keep the person's casing. */
export function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, " ").replace(/[\s,.;:]+$/g, "").trim();
}

function mapFields(data: WebflowFormData): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const normalizedKey = key.toLowerCase().trim();
    const mappedField = FIELD_MAP[normalizedKey];
    if (mappedField) {
      mapped[mappedField] = value;
    }
  }

  // Derive fullName if not provided
  if (!mapped.fullName && (mapped.firstName || mapped.lastName)) {
    mapped.fullName = `${mapped.firstName ?? ""} ${mapped.lastName ?? ""}`.trim();
  }

  // Hygiene: consistent email / phone / company so search, dedupe, and the
  // area-code lookup behave. Display strings stay human (no E.164 in the UI).
  if (typeof mapped.email === "string") mapped.email = normalizeEmail(mapped.email);
  if (typeof mapped.phone === "string") mapped.phone = normalizePhone(mapped.phone);
  if (typeof mapped.alternatePhone === "string") mapped.alternatePhone = normalizePhone(mapped.alternatePhone);
  for (const k of ["fullName", "firstName", "lastName", "companyName", "city", "title"] as const) {
    if (typeof mapped[k] === "string") mapped[k] = normalizeText(mapped[k] as string);
  }
  if (typeof mapped.companyName === "string" && /^(n\/?a|none|no|-+|independent)$/i.test(mapped.companyName)) {
    mapped.companyName = null;
  }

  // Parse balance to number
  if (mapped.balanceAmount && typeof mapped.balanceAmount === "string") {
    const cleaned = mapped.balanceAmount.replace(/[$,\s]/g, "");
    const num = parseFloat(cleaned);
    mapped.balanceAmount = isNaN(num) ? null : num;
  }

  if (mapped.estimatedClaimValue && typeof mapped.estimatedClaimValue === "string") {
    const cleaned = mapped.estimatedClaimValue.replace(/[$,\s]/g, "");
    const num = parseFloat(cleaned);
    mapped.estimatedClaimValue = isNaN(num) ? null : num;
  }

  // Derive a numeric copy of accountVolume (units) for range filtering/sorting.
  // The original string is preserved on the lead for display.
  if (mapped.accountVolume != null) {
    const n = parseInt(String(mapped.accountVolume).replace(/[^0-9-]/g, ""), 10);
    mapped.accountVolumeNum = Number.isNaN(n) ? null : n;
  }

  return mapped;
}

/** Post the prospect's free-text comment to the timeline (skipped when empty,
 * when they ticked "no questions", or when it's unchanged from a prior submission). */
async function logProspectComment(
  leadId: string,
  intake: Record<string, unknown> | undefined,
  previousIntake: Record<string, unknown> | null
) {
  const comment = typeof intake?.comments === "string" ? intake.comments.trim() : "";
  if (!comment || intake?.noQuestions) return;
  const prev = typeof previousIntake?.comments === "string" ? previousIntake.comments.trim() : "";
  if (prev === comment) return;
  await prisma.leadEvent.create({
    data: { leadId, eventType: "prospect_comment", eventDataJson: { comment } },
  });
}

export async function ingestLead(
  formData: WebflowFormData,
  metadata?: {
    /** True when the lead comes from an abandoned partial: staff get one summary notification from the cron instead of one per lead. */
    abandonedForm?: boolean;
    source?: string;
    sourcePage?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    referrer?: string;
    /** Visitor context (location/device/timezone/user_agent/clarity_url) —
     * stored for the timeline's submission table, internal eyes only. */
    [key: string]: unknown;
  }
) {
  const mapped = mapFields(formData);

  // Avg rent / unit lives only in the raw intake payload — derive a numeric
  // copy for range filtering (the raw value stays in rawPayloadJson for display).
  const rawIntake = formData._rawIntakeForm as Record<string, unknown> | undefined;
  const avgRentRaw = rawIntake?.avgRent;
  const avgRentNum =
    typeof avgRentRaw === "number" && !Number.isNaN(avgRentRaw)
      ? Math.round(avgRentRaw)
      : null;

  // Create lead record
  const lead = await prisma.lead.create({
    data: {
      firstName: mapped.firstName as string | undefined,
      lastName: mapped.lastName as string | undefined,
      fullName: mapped.fullName as string | undefined,
      companyName: mapped.companyName as string | undefined,
      title: mapped.title as string | undefined,
      email: mapped.email as string | undefined,
      phone: mapped.phone as string | undefined,
      alternatePhone: mapped.alternatePhone as string | undefined,
      address1: mapped.address1 as string | undefined,
      address2: mapped.address2 as string | undefined,
      city: mapped.city as string | undefined,
      state: mapped.state as string | undefined,
      states: mapped.statesArray ?? undefined,
      zip: mapped.zip as string | undefined,
      country: mapped.country as string | undefined,
      industry: mapped.industry as string | undefined,
      debtType: mapped.debtType as string | undefined,
      balanceAmount: mapped.balanceAmount as number | undefined,
      estimatedClaimValue: mapped.estimatedClaimValue as number | undefined,
      accountVolume: mapped.accountVolume as string | undefined,
      accountVolumeNum: mapped.accountVolumeNum as number | null | undefined,
      avgRentNum,
      serviceRequested: mapped.serviceRequested as string | undefined,
      notesFromForm: mapped.notesFromForm as string | undefined,
      urgency: mapped.urgency as string | undefined,
      businessType: mapped.businessType as string | undefined,
      rawPayloadJson: formData as Record<string, string>,
      source: metadata?.source ?? "webflow",
      leadSource: metadata?.source ?? "website",
      sourcePage: metadata?.sourcePage,
      utmSource: metadata?.utmSource,
      utmMedium: metadata?.utmMedium,
      utmCampaign: metadata?.utmCampaign,
      referrer: metadata?.referrer,
      status: "NEW",
      lastActivityAt: new Date(),
    },
  });

  // Log creation event
  await logEvent(lead.id, "lead_created", {
    source: metadata?.source ?? "webflow",
  });

  // Log submission data for timeline display
  await prisma.leadEvent.create({
    data: {
      leadId: lead.id,
      eventType: "lead_data_received",
      eventDataJson: {
        fields: (formData._rawIntakeForm as Record<string, unknown>) ?? formData,
        metadata: metadata ?? {},
      } as Prisma.InputJsonValue,
    },
  });

  // Anything they typed in the comments box goes straight onto the timeline.
  await logProspectComment(lead.id, rawIntake, null);

  // Run scoring
  const scoreResult = await scoreAndUpdateLead(lead.id);

  // Check for duplicates
  const duplicates = await findDuplicates({
    email: lead.email,
    phone: lead.phone,
    companyName: lead.companyName,
    fullName: lead.fullName,
  });

  // Filter out self from duplicates
  const otherDuplicates = duplicates.filter((d) => d.leadId !== lead.id);
  if (otherDuplicates.length > 0) {
    await logEvent(lead.id, "duplicate_flagged", {
      matches: otherDuplicates,
    });
  }

  // Evaluate referral if score is low
  if (scoreResult.qualityTier === "POOR" || scoreResult.qualityTier === "C") {
    const referrals = await evaluateReferral(lead);
    if (referrals.length > 0) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { recommendedReferralId: referrals[0].partner.id },
      });
    }
  }

  // Notify staff about new lead
  const leadLabel = lead.companyName || lead.fullName || "New Lead";
  const tierLabel = scoreResult.qualityTier ?? "Unscored";
  const isHighPriority = scoreResult.qualityTier === "A Lead" || (scoreResult.score ?? 0) >= 80;

  if (!metadata?.abandonedForm) await createNotificationsForRole(
    "INTAKE",
    "new_lead",
    `New ${tierLabel}: ${leadLabel}`,
    `${lead.state ?? ""} ${lead.accountVolume ? `| ${lead.accountVolume} units` : ""} | Score: ${scoreResult.score ?? "N/A"}`.trim(),
    lead.id,
    isHighPriority ? "HIGH" : "NORMAL"
  ).catch(() => {}); // Don't fail ingestion if notification fails

  return lead;
}

/**
 * A prospect resubmitted the form for a session that already produced a lead:
 * either they used the edit link from their confirmation email, or they came
 * back through a recapture resume link and finished a previously abandoned
 * session. Updates the existing lead in place (no duplicate), rescores it,
 * logs the change, and tells the assigned user.
 */
export async function updateLeadFromResubmission(
  leadId: string,
  formData: WebflowFormData,
  metadata?: { source?: string; [key: string]: unknown }
) {
  const mapped = mapFields(formData);
  const rawIntake = formData._rawIntakeForm as Record<string, unknown> | undefined;
  const avgRentRaw = rawIntake?.avgRent;
  const avgRentNum =
    typeof avgRentRaw === "number" && !Number.isNaN(avgRentRaw) ? Math.round(avgRentRaw) : null;

  const before = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const wasAbandoned = before.fromAbandonedForm;

  const data: Record<string, unknown> = {
    firstName: mapped.firstName,
    lastName: mapped.lastName,
    fullName: mapped.fullName,
    companyName: mapped.companyName,
    title: mapped.title,
    email: mapped.email,
    phone: mapped.phone,
    alternatePhone: mapped.alternatePhone,
    address1: mapped.address1,
    address2: mapped.address2,
    city: mapped.city,
    state: mapped.state,
    states: mapped.statesArray,
    zip: mapped.zip,
    country: mapped.country,
    industry: mapped.industry,
    debtType: mapped.debtType,
    balanceAmount: mapped.balanceAmount,
    estimatedClaimValue: mapped.estimatedClaimValue,
    accountVolume: mapped.accountVolume,
    accountVolumeNum: mapped.accountVolumeNum,
    avgRentNum,
    serviceRequested: mapped.serviceRequested,
    notesFromForm: mapped.notesFromForm,
    urgency: mapped.urgency,
    businessType: mapped.businessType,
    rawPayloadJson: formData as Record<string, string>,
    // A completed resubmission means this is a real inquiry now.
    fromAbandonedForm: false,
    lastActivityAt: new Date(),
  };
  for (const k of Object.keys(data)) {
    if (data[k] === undefined) delete data[k];
  }

  await prisma.lead.update({ where: { id: leadId }, data: data as never });

  await logEvent(leadId, "lead_data_received", {
    fields: (formData._rawIntakeForm as Record<string, unknown>) ?? formData,
    metadata: { ...(metadata ?? {}), resubmission: true },
  });
  await prisma.leadEvent.create({
    data: {
      leadId,
      eventType: "prospect_updated_details",
      eventDataJson: { wasAbandoned },
    },
  });
  const beforeRaw = before.rawPayloadJson as Record<string, unknown> | null;
  const beforeIntake = (beforeRaw?._rawIntakeForm as Record<string, unknown>) ?? beforeRaw ?? null;
  await logProspectComment(leadId, rawIntake, beforeIntake);

  const scoreResult = await scoreAndUpdateLead(leadId);

  if (before.assignedUserId) {
    const { createNotification } = await import("./notification.service");
    await createNotification(
      before.assignedUserId,
      "lead_updated",
      wasAbandoned
        ? `Abandoned lead completed the form: ${before.fullName ?? before.companyName ?? "Lead"}`
        : `Lead updated their details: ${before.fullName ?? before.companyName ?? "Lead"}`,
      `New score: ${scoreResult.score ?? "N/A"}`,
      leadId,
      "NORMAL"
    ).catch(() => {});
  } else if (wasAbandoned) {
    await createNotificationsForRole(
      "INTAKE",
      "new_lead",
      `Recaptured: ${before.fullName ?? before.companyName ?? "Lead"} finished the form`,
      `Score: ${scoreResult.score ?? "N/A"}`,
      leadId,
      "HIGH"
    ).catch(() => {});
  }

  return prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
}
