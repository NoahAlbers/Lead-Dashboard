// Shared mustache-style template renderer for lead emails. Used by the email
// dialog (mailto) and the referral-email .eml builder so placeholders stay
// consistent. The `extras` map lets callers inject dynamic values such as
// {{lead_data_table}} (an HTML table of the lead's submission data).

export interface EmailLeadData {
  id: string;
  email: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  title?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  states?: string[] | null;
  zip?: string | null;
  country?: string | null;
  industry?: string | null;
  debtType?: string | null;
  balanceAmount?: number | null;
  estimatedClaimValue?: number | null;
  accountVolume?: string | null;
  serviceRequested?: string | null;
  notesFromForm?: string | null;
  urgency?: string | null;
  businessType?: string | null;
  geographicScope?: string | null;
  leadSource?: string | null;
  sourcePage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  score?: number | null;
  qualityTier?: string | null;
  status?: string | null;
  createdAt?: string | null;
}

export interface EmailReferralPartner {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  emails: string[] | null;
  phone: string | null;
  website: string | null;
  contingencyRate?: string | null;
  upfrontCosts?: string | null;
  minimumAccounts?: number | null;
  minimumTotalBalance?: number | null;
}

/** Best-effort first name: explicit field, else first token of full name. */
export function firstNameOf(lead: EmailLeadData): string {
  if (lead.firstName) return lead.firstName;
  if (lead.fullName) return lead.fullName.trim().split(/\s+/)[0] ?? "";
  return "";
}

export function renderTemplate(
  template: string,
  lead: EmailLeadData,
  assignedUserName: string,
  partner?: EmailReferralPartner | null,
  extras?: Record<string, string>
): string {
  const replacements: Record<string, string> = {
    // Contact
    "{{first_name}}": firstNameOf(lead),
    "{{last_name}}": lead.lastName ?? "",
    "{{full_name}}": lead.fullName ?? "",
    "{{company_name}}": lead.companyName ?? "",
    "{{title}}": lead.title ?? "",
    "{{email}}": lead.email ?? "",
    "{{phone}}": lead.phone ?? "",
    "{{alternate_phone}}": lead.alternatePhone ?? "",
    // Location
    "{{address_1}}": lead.address1 ?? "",
    "{{address_2}}": lead.address2 ?? "",
    "{{city}}": lead.city ?? "",
    "{{state}}": lead.state ?? "",
    "{{zip}}": lead.zip ?? "",
    "{{country}}": lead.country ?? "",
    // Business
    "{{industry}}": lead.industry ?? "",
    "{{debt_type}}": lead.debtType ?? "",
    "{{balance_amount}}": lead.balanceAmount != null ? `$${lead.balanceAmount.toLocaleString()}` : "",
    "{{estimated_claim_value}}": lead.estimatedClaimValue != null ? `$${lead.estimatedClaimValue.toLocaleString()}` : "",
    "{{units}}": lead.accountVolume ?? "",
    "{{service_requested}}": lead.serviceRequested ?? "",
    "{{notes_from_form}}": lead.notesFromForm ?? "",
    "{{urgency}}": lead.urgency ?? "",
    "{{business_type}}": lead.businessType ?? "",
    "{{geographic_scope}}": lead.geographicScope ?? "",
    // Metadata
    "{{lead_source}}": lead.leadSource ?? "",
    "{{source_page}}": lead.sourcePage ?? "",
    "{{utm_source}}": lead.utmSource ?? "",
    "{{utm_medium}}": lead.utmMedium ?? "",
    "{{utm_campaign}}": lead.utmCampaign ?? "",
    // System
    "{{score}}": lead.score != null ? String(lead.score) : "",
    "{{quality_tier}}": lead.qualityTier ?? "",
    "{{status}}": lead.status ?? "",
    "{{assigned_user_name}}": assignedUserName,
    "{{created_at}}": lead.createdAt ?? "",
    // Referral Partner
    "{{referral_partner_name}}": partner?.name ?? "",
    "{{referral_partner_contact_name}}": partner?.contactName ?? "",
    "{{referral_partner_email}}": partner?.email ?? "",
    "{{referral_partner_phone}}": partner?.phone ?? "",
    "{{referral_partner_website}}": partner?.website ?? "",
    "{{referral_partner_contingency_rate}}": partner?.contingencyRate ?? "",
    "{{referral_partner_upfront_costs}}": partner?.upfrontCosts ?? "",
    "{{referral_partner_minimum_accounts}}": partner?.minimumAccounts != null ? String(partner.minimumAccounts) : "",
    "{{referral_partner_minimum_total_balance}}": partner?.minimumTotalBalance != null ? `$${partner.minimumTotalBalance.toLocaleString()}` : "",
    // Caller-supplied (e.g. the lead data table HTML)
    ...(extras ?? {}),
  };

  let result = template;
  for (const [key, val] of Object.entries(replacements)) {
    result = result.replaceAll(key, val);
  }
  return result;
}
