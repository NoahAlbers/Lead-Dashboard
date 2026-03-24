import { sendEmail, getNotificationEmails } from "@/lib/email";
import type { NormalizedPayload } from "@/services/ingestion-pipeline.service";

interface NewLeadEmailData {
  receiptId: string;
  normalized: NormalizedPayload;
  score?: number;
  qualityTier?: string;
  recommendedAction?: string;
  leadId: string;
}

function buildLeadEmailHtml(data: NewLeadEmailData): string {
  const p = data.normalized;
  const rows: Array<[string, string]> = [];

  // Contact Info
  if (p.fullName) rows.push(["Name", p.fullName]);
  if (p.companyName) {
    rows.push([
      "Company",
      p.noCompany ? "(Independent owner)" : p.companyName,
    ]);
  }
  if (p.email)
    rows.push([
      "Email",
      `<a href="mailto:${p.email}" style="color:#2563eb">${p.email}</a>`,
    ]);
  if (p.phone)
    rows.push([
      "Phone",
      `<a href="tel:${p.phone}" style="color:#2563eb">${p.phone}</a>`,
    ]);

  // Website
  if (p.companyWebsite && !p.noWebsite) {
    const url = p.companyWebsite.startsWith("http")
      ? p.companyWebsite
      : `https://${p.companyWebsite}`;
    rows.push([
      "Website",
      `<a href="${url}" style="color:#2563eb">${p.companyWebsite}</a>`,
    ]);
  } else if (p.noWebsite) {
    rows.push([
      "Website",
      '<span style="color:#9ca3af">None provided</span>',
    ]);
  }

  // Collections Info
  if (p.debtTypes.length > 0) {
    let debtStr = p.debtTypes.join(", ");
    if (p.customDebtType) debtStr += ` (${p.customDebtType})`;
    rows.push(["Debt Types", debtStr]);
  }
  if (p.debtsNow) rows.push(["Debts Ready Now", p.debtsNow]);
  if (p.priorAgency) rows.push(["Prior Collection Agency", p.priorAgency]);

  // States (ALL of them)
  if (p.states.length > 0) rows.push(["States", p.states.join(", ")]);

  // Residential path fields
  if (p.ownershipType) {
    let ownerStr = p.ownershipType;
    if (p.ownPercent != null)
      ownerStr += ` (${p.ownPercent}% own / ${100 - p.ownPercent}% manage)`;
    rows.push(["Ownership", ownerStr]);
  }
  if (p.totalUnits) rows.push(["Total Units", p.totalUnits]);
  if (p.rentalTypes.length > 0)
    rows.push(["Rental Types", p.rentalTypes.join(", ")]);
  if (p.propertyTypes.length > 0)
    rows.push(["Property Types", p.propertyTypes.join(", ")]);
  if (p.avgRent)
    rows.push(["Avg Rent / Unit", `$${p.avgRent.toLocaleString()}/mo`]);
  if (p.listingSites.length > 0) {
    let listStr = p.listingSites.join(", ");
    if (p.customListing) listStr += ` (${p.customListing})`;
    rows.push(["Listing Sites", listStr]);
  }
  if (p.pmSoftware.length > 0) {
    let pmStr = p.pmSoftware.join(", ");
    if (p.customPM) pmStr += ` (${p.customPM})`;
    rows.push(["PM Software", pmStr]);
  }

  // Comments
  if (p.comments && !p.noQuestions) {
    rows.push([
      "Comments",
      `<div style="background:#f9fafb;border-left:3px solid #6366f1;padding:8px 12px;border-radius:0 4px 4px 0;white-space:pre-wrap">${p.comments}</div>`,
    ]);
  } else if (p.noQuestions) {
    rows.push([
      "Comments",
      '<span style="color:#9ca3af">No questions</span>',
    ]);
  }

  // Certifications
  if (p.certifyOwesDebt)
    rows.push([
      "Certification",
      "States they OWE a debt — may need to be redirected",
    ]);
  if (p.certifyNoDebt)
    rows.push(["Certification", "Confirmed: does not owe a debt"]);

  // Scoring
  rows.push([
    "Score",
    `${data.score ?? "N/A"} (${data.qualityTier ?? "Unscored"})`,
  ]);
  if (data.recommendedAction)
    rows.push(["Recommended Action", data.recommendedAction]);

  // Tracking / Metadata
  if (p.location) rows.push(["Location / IP", p.location]);
  if (p.device) rows.push(["Device", p.device]);
  if (p.referrer) {
    rows.push([
      "Referrer",
      p.referrer === "direct"
        ? "Direct"
        : `<a href="${p.referrer}" style="color:#2563eb">${p.referrer}</a>`,
    ]);
  }
  if (p.clarityRecording) {
    const isUrl = p.clarityRecording.startsWith("http");
    const link = isUrl
      ? p.clarityRecording
      : `https://clarity.microsoft.com/player/qo6gcqjdc7/${p.clarityRecording}`;
    rows.push([
      "Clarity Recording",
      `<a href="${link}" style="color:#2563eb">View Recording</a>`,
    ]);
  }
  if (p.timezone) rows.push(["Likely Timezone", p.timezone]);
  if (p.submittedAt) rows.push(["Submitted", p.submittedAt]);
  rows.push(["Receipt #", data.receiptId]);

  // Build HTML table
  const tableRows = rows
    .map(
      ([label, value], i) =>
        `<tr style="background:${i % 2 === 0 ? "#f9fafb" : "#ffffff"}">
      <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;width:30%;font-size:14px;vertical-align:top;white-space:nowrap">${label}</td>
      <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#111827;font-size:14px">${value}</td>
    </tr>`
    )
    .join("");

  const tierColor =
    data.qualityTier === "A Lead"
      ? "#16a34a"
      : data.qualityTier === "B Lead"
        ? "#2563eb"
        : data.qualityTier === "C Lead"
          ? "#d97706"
          : "#ef4444";

  return `
    <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto">
      <div style="background:#1e3a5f;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0 0 4px;font-size:18px">New Lead Received</h2>
        <p style="margin:0;font-size:14px;opacity:0.85">
          ${p.fullName || "Unknown"} ${p.companyName ? `| ${p.companyName}` : ""}
          <span style="display:inline-block;background:${tierColor};color:white;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;margin-left:8px">${data.qualityTier || "Unscored"} — ${data.score ?? "N/A"}</span>
        </p>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
        ${tableRows}
      </table>
      <div style="padding:14px 18px;background:#f3f4f6;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none">
        <p style="margin:0;font-size:12px;color:#6b7280">
          ACB Lead Console — <a href="https://www.advancedcb.app/leads/${data.leadId}" style="color:#2563eb">View in Dashboard</a>
        </p>
      </div>
    </div>
  `;
}

export async function sendNewLeadEmail(data: NewLeadEmailData) {
  const recipients = getNotificationEmails();
  if (recipients.length === 0) return;

  const p = data.normalized;
  const name = p.companyName || p.fullName || "Unknown";
  const tier = data.qualityTier ?? "Unscored";
  const subject = `[New Lead] ${tier}: ${name}`;

  return sendEmail({
    to: recipients,
    subject,
    html: buildLeadEmailHtml(data),
    replyTo: p.email ?? undefined,
  });
}

export async function sendFailureAlertEmail(details: {
  type: string;
  message: string;
  submissionId?: string;
  timestamp: string;
}) {
  const recipients = getNotificationEmails();
  if (recipients.length === 0) return;

  return sendEmail({
    to: recipients,
    subject: `[ALERT] Lead Ingestion Failure: ${details.type}`,
    html: `
      <h2 style="color:#dc2626;margin-bottom:16px;">Lead Ingestion Failure</h2>
      <table style="border-collapse:collapse;width:100%;max-width:500px;">
        <tr><td style="padding:6px 12px;font-weight:bold;color:#555;">Type</td><td style="padding:6px 12px;">${details.type}</td></tr>
        <tr style="background:#f8f9fa;"><td style="padding:6px 12px;font-weight:bold;color:#555;">Message</td><td style="padding:6px 12px;">${details.message}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold;color:#555;">Submission ID</td><td style="padding:6px 12px;">${details.submissionId ?? "N/A"}</td></tr>
        <tr style="background:#f8f9fa;"><td style="padding:6px 12px;font-weight:bold;color:#555;">Time</td><td style="padding:6px 12px;">${details.timestamp}</td></tr>
      </table>
      <p style="margin-top:20px;"><a href="https://www.advancedcb.app/admin/monitor" style="background:#dc2626;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View Monitor</a></p>
    `,
  });
}
