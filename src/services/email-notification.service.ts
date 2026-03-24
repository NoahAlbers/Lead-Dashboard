import { sendEmail, getNotificationEmails } from "@/lib/email";

export async function sendNewLeadEmail(lead: {
  id: string;
  fullName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  accountVolume?: string | null;
  score?: number | null;
  qualityTier?: string | null;
}) {
  const recipients = getNotificationEmails();
  if (recipients.length === 0) return;

  const name = lead.companyName || lead.fullName || "Unknown";
  const tier = lead.qualityTier ?? "Unscored";
  const subject = `[New Lead] ${tier}: ${name}`;

  const html = `
    <h2 style="color:#1a1a2e;margin-bottom:16px;">New Lead Received</h2>
    <table style="border-collapse:collapse;width:100%;max-width:500px;">
      <tr><td style="padding:6px 12px;font-weight:bold;color:#555;">Name</td><td style="padding:6px 12px;">${lead.fullName ?? "N/A"}</td></tr>
      <tr style="background:#f8f9fa;"><td style="padding:6px 12px;font-weight:bold;color:#555;">Company</td><td style="padding:6px 12px;">${lead.companyName ?? "N/A"}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;color:#555;">Email</td><td style="padding:6px 12px;">${lead.email ?? "N/A"}</td></tr>
      <tr style="background:#f8f9fa;"><td style="padding:6px 12px;font-weight:bold;color:#555;">Phone</td><td style="padding:6px 12px;">${lead.phone ?? "N/A"}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;color:#555;">State</td><td style="padding:6px 12px;">${lead.state ?? "N/A"}</td></tr>
      <tr style="background:#f8f9fa;"><td style="padding:6px 12px;font-weight:bold;color:#555;">Units</td><td style="padding:6px 12px;">${lead.accountVolume ?? "N/A"}</td></tr>
      <tr><td style="padding:6px 12px;font-weight:bold;color:#555;">Score</td><td style="padding:6px 12px;">${lead.score ?? "N/A"}</td></tr>
      <tr style="background:#f8f9fa;"><td style="padding:6px 12px;font-weight:bold;color:#555;">Tier</td><td style="padding:6px 12px;">${tier}</td></tr>
    </table>
    <p style="margin-top:20px;"><a href="https://www.advancedcb.app/leads/${lead.id}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View in Lead Console</a></p>
  `;

  return sendEmail({
    to: recipients,
    subject,
    html,
    replyTo: lead.email ?? undefined,
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
