// Builds a formatted referral email (prose + a two-column case-data table) and
// packages it as an .eml file with `X-Unsent: 1`, which Outlook opens as an
// editable, ready-to-send draft — HTML table and all (mailto can't do that).

import {
  renderTemplate,
  firstNameOf,
  type EmailLeadData,
  type EmailReferralPartner,
} from "./email-template-render";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function asList(val: unknown): string {
  if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean).join(", ");
  if (val == null) return "";
  return String(val).trim();
}

function formatRent(val: unknown): string {
  const num =
    typeof val === "number"
      ? val
      : typeof val === "string"
        ? parseFloat(val.replace(/[$,\s]/g, ""))
        : NaN;
  return Number.isNaN(num) ? "" : `$${num.toLocaleString()}/mo`;
}

/** First non-empty value across the intake payload then the lead record. */
function pick(
  intake: Record<string, unknown>,
  lead: Record<string, unknown>,
  keys: string[]
): unknown {
  for (const k of keys) {
    if (intake[k] != null && intake[k] !== "") return intake[k];
  }
  for (const k of keys) {
    if (lead[k] != null && lead[k] !== "") return lead[k];
  }
  return null;
}

/**
 * Two-column HTML table of the lead's submission data — the rows mirror the
 * referral email screenshot (case data only, no internal metadata). Rows with
 * no value are omitted (Website shows "None provided").
 */
export function buildLeadDataTableHtml(
  lead: EmailLeadData,
  rawIntakeForm?: Record<string, unknown> | null
): string {
  const intake = rawIntakeForm ?? {};
  const leadObj = lead as unknown as Record<string, unknown>;

  const emailVal = String(pick(intake, leadObj, ["email"]) ?? "");
  const phoneVal = String(pick(intake, leadObj, ["phone"]) ?? "");
  const websiteRaw = String(pick(intake, leadObj, ["companyWebsite", "company_website", "website"]) ?? "");
  const websiteHref = websiteRaw && !/^https?:\/\//i.test(websiteRaw) ? `https://${websiteRaw}` : websiteRaw;

  type Row = { label: string; html: string };
  const rows: Row[] = [];
  const add = (label: string, value: string, html?: string) => {
    if (!value) return;
    rows.push({ label, html: html ?? escapeHtml(value) });
  };

  add("Name", asList(pick(intake, leadObj, ["fullName", "full_name", "name"])));
  add("Company", asList(pick(intake, leadObj, ["companyName", "company_name", "company"])));
  if (emailVal) rows.push({ label: "Email", html: `<a href="mailto:${escapeHtml(emailVal)}">${escapeHtml(emailVal)}</a>` });
  if (phoneVal) rows.push({ label: "Phone", html: `<a href="tel:${escapeHtml(phoneVal.replace(/[^0-9+]/g, ""))}">${escapeHtml(phoneVal)}</a>` });
  rows.push({
    label: "Website",
    html: websiteRaw
      ? `<a href="${escapeHtml(websiteHref)}">${escapeHtml(websiteRaw)}</a>`
      : "None provided",
  });
  add("Debt Types", asList(pick(intake, leadObj, ["debtTypes", "debt_type", "debtType", "serviceRequested", "service_requested"])));
  add("Debts Ready Now", asList(pick(intake, leadObj, ["debtsNow", "debts_ready"])));
  add("Prior Agency", asList(pick(intake, leadObj, ["priorAgency", "prior_agency"])));
  add("States", asList(pick(intake, leadObj, ["states", "statesArray", "state"])));
  add("Ownership", asList(pick(intake, leadObj, ["ownershipType", "ownership", "businessType", "business_type"])));
  add("Total Units", asList(pick(intake, leadObj, ["totalUnits", "total_units", "accountVolume", "account_volume"])));
  add("Rental Types", asList(pick(intake, leadObj, ["rentalTypes", "rental_types"])));
  add("Property Types", asList(pick(intake, leadObj, ["propertyTypes", "property_types"])));
  add("Avg Rent / Unit", formatRent(pick(intake, leadObj, ["avgRent", "avg_rent"])));
  add("Listing Sites", asList(pick(intake, leadObj, ["listingSites", "listing_locations"])));
  add("PM Software", asList(pick(intake, leadObj, ["pmSoftware", "pm_software"])));
  add("Comments", asList(pick(intake, leadObj, ["comments", "notes_from_form", "notesFromForm"])));

  const cell = "border:1px solid #b0b0b0;padding:4px 9px;vertical-align:top;";
  const body = rows
    .map(
      (r) =>
        `<tr><td style="${cell}font-weight:bold;background:#f3f3f3;white-space:nowrap;">${escapeHtml(
          r.label
        )}</td><td style="${cell}">${r.html}</td></tr>`
    )
    .join("");

  return `<table style="border-collapse:collapse;margin:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111;">${body}</table>`;
}

export const BUILTIN_REFERRAL_TEMPLATE = {
  name: "Referral Recommendation (built-in)",
  subjectTemplate: "Collection Recommendation for {{first_name}} - {{referral_partner_name}}",
  bodyTemplate: `<p>Hey {{first_name}},</p>
<p>Advanced Collection Bureau only works with larger property management companies, so we unfortunately won't be able to help you out. But I have taken some time to find agencies that are good for other business to consumer debts.</p>
<p>I think {{referral_partner_name}} would be the best go-to for your collection needs.</p>
<p>If {{referral_partner_name}} can't help you out just let me know and I can find another recommendation for you, but these guys should be the best.</p>
<p>Here's the contact info for {{referral_partner_name}}:<br>
{{referral_partner_website}}<br>
{{referral_partner_phone}}<br>
{{referral_partner_email}}</p>
<p>{{referral_partner_contact_name}} is the best person to go to here, and I've got them on this email too.</p>
<p>{{referral_partner_contact_name}} – here's some of the info for their collections:</p>
{{lead_data_table}}
<p>{{assigned_user_name}}<br>Director of Business Development<br>Advanced Collection Bureau, Inc</p>`,
};

function wrapHtmlDocument(inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5;">${inner}</body></html>`;
}

function dedupeEmails(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const e = (v ?? "").trim();
    if (e && !seen.has(e.toLowerCase())) {
      seen.add(e.toLowerCase());
      out.push(e);
    }
  }
  return out;
}

export interface RenderedReferralEmail {
  subject: string;
  html: string;
  to: string[];
}

/**
 * Render the referral email. Pass a custom subject/body (e.g. from a DB
 * template) or omit them to use the built-in. `to` is the lead + partner emails.
 */
export function renderReferralEmail(args: {
  lead: EmailLeadData;
  partner: EmailReferralPartner | null;
  assignedUserName: string;
  rawIntakeForm?: Record<string, unknown> | null;
  subjectTemplate?: string;
  bodyTemplate?: string;
}): RenderedReferralEmail {
  const { lead, partner, assignedUserName, rawIntakeForm } = args;
  const tableHtml = buildLeadDataTableHtml(lead, rawIntakeForm);
  const subject = renderTemplate(
    args.subjectTemplate || BUILTIN_REFERRAL_TEMPLATE.subjectTemplate,
    lead,
    assignedUserName,
    partner
  );
  const inner = renderTemplate(
    args.bodyTemplate || BUILTIN_REFERRAL_TEMPLATE.bodyTemplate,
    lead,
    assignedUserName,
    partner,
    { "{{lead_data_table}}": tableHtml }
  );
  const to = dedupeEmails([lead.email, partner?.email, ...(partner?.emails ?? [])]);
  return { subject, html: wrapHtmlDocument(inner), to };
}

function toBase64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa exists in the browser (this is only called client-side).
  return btoa(bin);
}

/**
 * RFC822 message with X-Unsent:1 so classic Outlook opens it as an editable
 * draft. The HTML body is base64-encoded (wrapped at 76 cols) to avoid the
 * long-line / encoding issues that make some clients show it as plain text.
 */
export function buildEml(args: { to: string; cc?: string; subject: string; html: string }): string {
  const body = (toBase64Utf8(args.html).match(/.{1,76}/g) ?? []).join("\r\n");
  const lines = [`To: ${args.to}`];
  if (args.cc) lines.push(`Cc: ${args.cc}`);
  lines.push(`Subject: ${args.subject}`);
  lines.push("X-Unsent: 1");
  lines.push("MIME-Version: 1.0");
  lines.push('Content-Type: text/html; charset="utf-8"');
  lines.push("Content-Transfer-Encoding: base64");
  lines.push("");
  lines.push(body);
  return lines.join("\r\n");
}

/** Client-only: download the .eml so double-clicking opens an Outlook draft. */
export function downloadEml(filename: string, eml: string): void {
  const blob = new Blob([eml], { type: "message/rfc822" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.toLowerCase().endsWith(".eml") ? filename : `${filename}.eml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Build a safe .eml filename from the lead + partner. */
export function referralEmailFilename(lead: EmailLeadData, partner: EmailReferralPartner | null): string {
  const who = (firstNameOf(lead) || lead.companyName || "lead").replace(/[^a-z0-9]+/gi, "-");
  const to = (partner?.name || "partner").replace(/[^a-z0-9]+/gi, "-");
  return `Referral-${who}-${to}.eml`;
}
