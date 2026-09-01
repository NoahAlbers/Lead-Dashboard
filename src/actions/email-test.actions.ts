"use server";

// Sends a sample of the lead confirmation email to the signed-in admin so the
// template and Resend wiring can be verified without a real form submission.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { renderAcbEmail, emailPanel, emailButton, escHtml } from "@/lib/acb-email";

const DEFAULT_SENDER = "Advanced Collection Bureau <noreply@advancedcb.com>";
const HIGH_VALUE_SENDER = "Noah Albers <nalbers@advancedcb.com>";

export async function sendTestConfirmationEmail(flavor: "standard" | "hot"): Promise<{ success: boolean; error?: string; to?: string }> {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }
  const to = session.user.email;
  if (!to) return { success: false, error: "Your account has no email address" };

  const senderKey = flavor === "hot" ? "email_sender_high_value" : "email_sender_default";
  const senderRow = await prisma.systemConfig.findUnique({ where: { key: senderKey } });
  const from =
    (senderRow?.value as string) || (flavor === "hot" ? HIGH_VALUE_SENDER : DEFAULT_SENDER);

  const rows = [
    ["Name", "Sample Lead"],
    ["Company", "Highland Test Properties"],
    ["States", "Florida, Texas"],
    ["Total units", flavor === "hot" ? "850" : "120"],
    ["Debt types", "Residential Rental Debt"],
  ]
    .map(
      ([l, v]) =>
        `<tr><td style="padding:3px 14px 3px 0;color:#8889A0;font-size:13px;white-space:nowrap;">${escHtml(l)}</td><td style="padding:3px 0;color:#1A1A2E;font-size:13px;">${escHtml(v)}</td></tr>`
    )
    .join("");

  const nextStep =
    flavor === "hot"
      ? `<p style="margin:0 0 14px;">Your portfolio looks like a strong fit for what we do. <b>Noah Albers, our Director of Business Development, will call you personally within 24 hours.</b> If you want to talk sooner, call or text him directly at (321) 379-6063.</p>`
      : `<p style="margin:0 0 14px;">Our team is reviewing your information now and will reach out shortly with next steps. Most inquiries hear back within one business day.</p>`;

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hey Sample,</p>
    <p style="margin:0 0 14px;">Thanks for reaching out to Advanced Collection Bureau. We received your inquiry and your information is safely in our system.</p>
    ${emailPanel(`<table role="presentation" cellpadding="0" cellspacing="0">${rows}</table>`)}
    ${nextStep}
    <p style="margin:0 0 14px;">In the meantime, you can learn more about how we recover past-due rent while protecting your relationships with former tenants.</p>
    ${emailButton("See how we work", "https://www.advancedcb.com/residential-services")}
    <p style="margin:0;color:#4A4A68;font-size:13px;">Need to add or correct anything? Just reply to this email.</p>`;

  const html = renderAcbEmail({
    preheader: "Test of the lead confirmation email.",
    bodyHtml,
    unsubscribeEmail: to,
  });

  const result = await sendEmail({
    to,
    from,
    subject: `[TEST] We received your inquiry (${flavor})`,
    html,
    replyTo: "nalbers@advancedcb.com",
  });

  return { ...result, to };
}
