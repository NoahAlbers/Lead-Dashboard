import { prisma } from "@/lib/db";
import { scoreAndUpdateLead } from "./scoring.service";
import { findDuplicates } from "./duplicate-detection.service";
import { evaluateReferral } from "./referral.service";
import { logEvent } from "./activity-log.service";

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
};

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

  return mapped;
}

export async function ingestLead(
  formData: WebflowFormData,
  metadata?: {
    source?: string;
    sourcePage?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    referrer?: string;
  }
) {
  const mapped = mapFields(formData);

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
      zip: mapped.zip as string | undefined,
      country: mapped.country as string | undefined,
      industry: mapped.industry as string | undefined,
      debtType: mapped.debtType as string | undefined,
      balanceAmount: mapped.balanceAmount as number | undefined,
      estimatedClaimValue: mapped.estimatedClaimValue as number | undefined,
      accountVolume: mapped.accountVolume as string | undefined,
      serviceRequested: mapped.serviceRequested as string | undefined,
      notesFromForm: mapped.notesFromForm as string | undefined,
      urgency: mapped.urgency as string | undefined,
      businessType: mapped.businessType as string | undefined,
      rawPayloadJson: formData,
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

  return lead;
}
