// Lead-facing automated emails (as opposed to the internal team notifications
// in email-notification.service.ts). Phase 1: the confirmation email sent to
// the prospect when they complete the intake form.

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  renderAcbEmail,
  emailPanel,
  emailButton,
  escHtml,
  buildUnsubscribeUrl,
  isEmailSuppressed,
  buildEditUrl,
  leadReplyTo,
} from "@/lib/acb-email";
import {
  evaluateHotLead,
  parseHotLeadConditions,
  type HotLeadContext,
} from "@/lib/hot-lead";
import { logger } from "@/lib/logger";

const DEFAULT_SENDER = "Advanced Collection Bureau <noreply@advancedcb.com>";
const HIGH_VALUE_SENDER = "Noah Albers <nalbers@advancedcb.com>";

async function configValue(key: string): Promise<unknown> {
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function stateClassMap(): Promise<Record<string, string>> {
  const rows = await prisma.stateClassification.findMany({ where: { active: true } });
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.stateAbbrev.toLowerCase()] = r.classification;
    map[r.stateName.toLowerCase()] = r.classification;
  }
  return map;
}

export interface SenderIdentity {
  from: string;
  isHot: boolean;
}

/** Pick the sender based on the configurable hot-lead conditions. */
export async function resolveSenderForLead(leadId: string): Promise<SenderIdentity> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { from: DEFAULT_SENDER, isHot: false };

  const raw = (lead.rawPayloadJson as Record<string, unknown> | null) ?? {};
  const intake = (raw._rawIntakeForm as Record<string, unknown> | null) ?? raw;
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

  const ctx: HotLeadContext = {
    units: lead.accountVolumeNum != null ? Number(lead.accountVolumeNum) : null,
    avgRent: lead.avgRentNum != null ? Number(lead.avgRentNum) : null,
    score: lead.score ?? null,
    states: arr(lead.states).length ? arr(lead.states) : arr(intake.states),
    rentalTypes: arr(intake.rentalTypes),
    propertyTypes: arr(intake.propertyTypes),
    debtTypes: arr(intake.debtTypes).length ? arr(intake.debtTypes) : lead.debtType ? [lead.debtType] : [],
    listingSites: arr(intake.listingSites),
    pmSoftware: arr(intake.pmSoftware),
    ownership: (intake.ownershipType as string) || lead.businessType || "",
    industry: lead.industry ?? "",
    businessType: lead.businessType ?? "",
    urgency: lead.urgency ?? "",
    qualityTier: lead.qualityTier ?? "",
    leadSource: lead.leadSource ?? lead.source ?? "",
  };

  const rules = parseHotLeadConditions(await configValue("hot_lead_conditions"));
  const isHot = evaluateHotLead(ctx, rules, await stateClassMap());

  const from = isHot
    ? ((await configValue("email_sender_high_value")) as string) || HIGH_VALUE_SENDER
    : ((await configValue("email_sender_default")) as string) || DEFAULT_SENDER;

  return { from, isHot };
}

/**
 * Confirmation email after a completed form submission. Skipped for
 * abandoned-form conversions (those get the recapture sequence instead),
 * suppressed addresses, and when disabled in settings.
 */
export async function sendLeadConfirmationEmail(
  leadId: string,
  sessionId?: string | null
): Promise<void> {
  const enabled = await configValue("lead_confirmation_enabled");
  if (enabled === false) return;

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead?.email) return;
  if (await isEmailSuppressed(lead.email)) {
    logger.info("LEAD_EMAIL", "Confirmation skipped, address suppressed", { leadId });
    return;
  }

  const { from, isHot } = await resolveSenderForLead(leadId);
  const firstName =
    lead.firstName || (lead.fullName ? lead.fullName.trim().split(/\s+/)[0] : "") || "there";

  const raw = (lead.rawPayloadJson as Record<string, unknown> | null) ?? {};
  const intake = (raw._rawIntakeForm as Record<string, unknown> | null) ?? raw;

  const summaryRows: string[] = [];
  const addRow = (label: string, val: unknown) => {
    const v = Array.isArray(val) ? val.filter(Boolean).join(", ") : val ? String(val) : "";
    if (v) {
      summaryRows.push(
        `<tr><td style="padding:3px 14px 3px 0;color:#8889A0;font-size:13px;white-space:nowrap;">${escHtml(label)}</td><td style="padding:3px 0;color:#1A1A2E;font-size:13px;">${escHtml(v)}</td></tr>`
      );
    }
  };
  addRow("Name", lead.fullName);
  addRow("Company", lead.companyName);
  addRow("States", (lead.states as string[] | null) ?? intake.states);
  addRow("Total units", intake.totalUnits ?? lead.accountVolume);
  addRow("Debt types", intake.debtTypes ?? lead.debtType);

  const nextStep = isHot
    ? `<p style="margin:0 0 14px;">Your portfolio looks like a strong fit for what we do. <b>Noah Albers, our Director of Business Development, will call you personally within 24 hours.</b> If you want to talk sooner, call or text him directly at (321) 379-6063.</p>`
    : `<p style="margin:0 0 14px;">Our team is reviewing your information now and will reach out shortly with next steps. Most inquiries hear back within one business day.</p>`;

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hey ${escHtml(firstName)},</p>
    <p style="margin:0 0 14px;">Thanks for reaching out to Advanced Collection Bureau. We received your inquiry and your information is safely in our system.</p>
    ${summaryRows.length ? emailPanel(`<table role="presentation" cellpadding="0" cellspacing="0">${summaryRows.join("")}</table>`) : ""}
    ${nextStep}
    <p style="margin:0 0 14px;">In the meantime, you can learn more about how we recover past-due rent while protecting your relationships with former tenants.</p>
    ${emailButton("See how we work", "https://www.advancedcb.com/residential-services")}
    <p style="margin:0;color:#4A4A68;font-size:13px;">Need to add or correct anything? ${
      sessionId
        ? `<a href="${escHtml(await buildEditUrl(sessionId))}" style="color:#3D5AF1;">Edit your details here</a> or just reply to this email.`
        : "Just reply to this email."
    }</p>`;

  const html = renderAcbEmail({
    preheader: "We received your inquiry. Here's what happens next.",
    bodyHtml,
    unsubscribeEmail: lead.email,
  });

  const result = await sendEmail({
    to: lead.email,
    from,
    subject: "We received your inquiry",
    html,
    replyTo: await leadReplyTo(),
    headers: { "List-Unsubscribe": `<${buildUnsubscribeUrl(lead.email)}>` },
  });

  await prisma.leadEvent.create({
    data: {
      leadId,
      eventType: result.success ? "confirmation_email_sent" : "confirmation_email_failed",
      eventDataJson: { to: lead.email, from, isHot, error: result.error ?? null },
    },
  });

  if (!result.success) {
    logger.error("LEAD_EMAIL", "Confirmation email failed", { leadId, error: result.error });
  }
}
