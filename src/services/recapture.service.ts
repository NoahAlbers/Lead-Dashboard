// Abandoned-form recapture: a short automated win-back sequence for leads who
// started the intake form, entered an email, and never finished.
//
// Sequence: Email 1 at enrollment (the abandon cron fires ~1 hour after the
// last activity), Email 2 about a day later, Email 3 about three days in.
// Hard cap of 3 sends. Any completion, team activity, unsubscribe, or bounce
// stops the sequence.

import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  renderAcbEmail,
  emailButton,
  escHtml,
  buildUnsubscribeUrl,
  isEmailSuppressed,
  intakeFormUrl,
  verifyEditToken,
} from "@/lib/acb-email";
import { resolveSenderForLead } from "@/services/lead-emails.service";
import { logger } from "@/lib/logger";

const MAX_SENDS = 3;
// Delay from each send to the next one
const STEP_DELAYS_HOURS = [23, 48];

async function resumeUrl(token: string): Promise<string> {
  const base = await intakeFormUrl();
  return `${base}${base.includes("?") ? "&" : "?"}resume=${token}`;
}

/**
 * Enroll a lead created from an abandoned partial. Safe to call blindly; it
 * quietly skips when the lead has no email, the address is suppressed or
 * already belongs to a completed inquiry, or an enrollment already exists.
 * Sends Email 1 immediately.
 */
export async function enrollAbandonedLead(
  leadId: string,
  sessionId: string | null,
  abandonedStep: string | null
): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead?.email) return;
  const email = lead.email.trim().toLowerCase();

  if (await isEmailSuppressed(email)) return;

  // If this address already completed the form separately, don't chase them.
  const completed = await prisma.lead.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      fromAbandonedForm: false,
      id: { not: leadId },
    },
  });
  if (completed) return;

  const existing = await prisma.recaptureEnrollment.findUnique({ where: { leadId } });
  if (existing) return;

  const token = crypto.randomBytes(24).toString("base64url");
  const enrollment = await prisma.recaptureEnrollment.create({
    data: {
      leadId,
      sessionId,
      email,
      resumeToken: token,
      abandonedStep,
      status: "active",
      currentStep: 0,
      nextSendAt: new Date(),
    },
  });

  logger.info("RECAPTURE", "Lead enrolled", { leadId, abandonedStep });

  // Send Email 1 right away
  await sendNextRecaptureEmail(enrollment.id).catch((err) => {
    logger.error("RECAPTURE", "Initial send failed", {
      leadId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

function firstNameFor(fullName: string | null, firstName: string | null): string {
  return firstName || (fullName ? fullName.trim().split(/\s+/)[0] : "") || "there";
}

function buildEmailContent(
  step: number,
  firstName: string,
  states: string[],
  isHot: boolean,
  resume: string
): { subject: string; bodyHtml: string; preheader: string } {
  const statesPhrase = states.length
    ? ` in ${states.slice(0, 3).join(", ")}`
    : "";

  if (step === 1) {
    return {
      subject: "Pick up where you left off",
      preheader: "Your answers are saved. Finishing takes about two minutes.",
      bodyHtml: `
        <p style="margin:0 0 14px;">Hey ${escHtml(firstName)},</p>
        <p style="margin:0 0 14px;">You started telling us about your past-due accounts but didn't quite get to the finish line. No problem, your answers are saved.</p>
        <p style="margin:0 0 14px;">Finishing up takes about two minutes, and then we can tell you exactly how we'd approach your recoveries.</p>
        ${emailButton("Finish my inquiry", resume)}
        <p style="margin:0;color:#4A4A68;font-size:13px;">If now isn't a good time, this link will hold your place.</p>`,
    };
  }

  if (step === 2) {
    return {
      subject: "Recovering past-due rent, the right way",
      preheader: "A quick look at how we recover what you're owed.",
      bodyHtml: `
        <p style="margin:0 0 14px;">Hey ${escHtml(firstName)},</p>
        <p style="margin:0 0 14px;">Wanted to share a little about who you'd be working with. At Advanced Collection Bureau we specialize in residential collections${escHtml(statesPhrase)}, and our certified collectors use a sales-minded approach that recovers past-due accounts while preserving your relationships with former tenants.</p>
        <p style="margin:0 0 6px;">What sets us apart:</p>
        <ul style="margin:0 0 14px;padding-left:22px;color:#1A1A2E;">
          <li style="margin-bottom:5px;">Expertise in lease contracts, move-out statements, and residential debt recovery</li>
          <li style="margin-bottom:5px;">We credit report delinquent accounts twice monthly, most agencies report once or not at all</li>
          <li style="margin-bottom:5px;">Over 25 years focused on residential collections</li>
          <li style="margin-bottom:5px;">Contingency pricing of 40%, so you only pay if we collect</li>
          <li style="margin-bottom:5px;">Advanced skip tracing to locate and contact debtors</li>
        </ul>
        <p style="margin:0 0 14px;">Your inquiry is still saved right where you left it.</p>
        ${emailButton("Finish my inquiry", resume)}`,
    };
  }

  return {
    subject: "Should we close your file?",
    preheader: "Last note from us. Your saved inquiry expires soon.",
    bodyHtml: `
      <p style="margin:0 0 14px;">Hey ${escHtml(firstName)},</p>
      <p style="margin:0 0 14px;">We'll assume the timing wasn't right and set your inquiry aside for now.</p>
      <p style="margin:0 0 14px;">If those past-due accounts are still on your plate, it takes about two minutes to finish where you left off. Or just reply to this email and I'll take it from there personally.</p>
      ${emailButton("Finish my inquiry", resume)}
      ${isHot ? `<p style="margin:0;color:#4A4A68;font-size:13px;">Prefer to talk it through? Call or text me directly at (321) 379-6063.</p>` : ""}`,
  };
}

/** Render and send the enrollment's next email, then advance its state. */
async function sendNextRecaptureEmail(enrollmentId: string): Promise<boolean> {
  const enrollment = await prisma.recaptureEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { lead: true },
  });
  if (!enrollment || enrollment.status !== "active") return false;

  const step = enrollment.currentStep + 1;
  if (step > MAX_SENDS) {
    await prisma.recaptureEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "exhausted", nextSendAt: null },
    });
    return false;
  }

  const token = enrollment.resumeToken;
  const { from, isHot } = await resolveSenderForLead(enrollment.leadId);
  const firstName = firstNameFor(enrollment.lead.fullName, enrollment.lead.firstName);
  const states = (enrollment.lead.states as string[] | null) ?? [];
  const resume = await resumeUrl(token);
  const { subject, bodyHtml, preheader } = buildEmailContent(step, firstName, states, isHot, resume);

  const html = renderAcbEmail({ preheader, bodyHtml, unsubscribeEmail: enrollment.email });
  const result = await sendEmail({
    to: enrollment.email,
    from,
    subject,
    html,
    replyTo: "nalbers@advancedcb.com",
    headers: { "List-Unsubscribe": `<${buildUnsubscribeUrl(enrollment.email)}>` },
  });

  await prisma.leadEvent.create({
    data: {
      leadId: enrollment.leadId,
      eventType: result.success ? "recapture_email_sent" : "recapture_email_failed",
      eventDataJson: { step, subject, to: enrollment.email, error: result.error ?? null },
    },
  });

  if (!result.success) {
    logger.error("RECAPTURE", "Send failed", { enrollmentId, step, error: result.error });
    return false;
  }

  const delayHours = STEP_DELAYS_HOURS[step - 1];
  await prisma.recaptureEnrollment.update({
    where: { id: enrollmentId },
    data: {
      currentStep: step,
      lastSentAt: new Date(),
      nextSendAt: delayHours != null ? new Date(Date.now() + delayHours * 3600 * 1000) : null,
      status: step >= MAX_SENDS ? "exhausted" : "active",
    },
  });
  return true;
}

/** The cron entry point: advance every due enrollment. */
export async function processRecaptureQueue(): Promise<{ due: number; sent: number; stopped: number }> {
  const due = await prisma.recaptureEnrollment.findMany({
    where: { status: "active", nextSendAt: { lte: new Date() } },
    include: { lead: true },
    take: 50,
  });

  let sent = 0;
  let stopped = 0;

  for (const e of due) {
    try {
      // Stop conditions re-checked at send time
      if (await isEmailSuppressed(e.email)) {
        await stopEnrollment(e.id, "suppressed");
        stopped++;
        continue;
      }
      if (!["NEW", "REVIEWED"].includes(e.lead.status)) {
        await stopEnrollment(e.id, `lead_status_${e.lead.status.toLowerCase()}`);
        stopped++;
        continue;
      }
      const completed = await prisma.lead.findFirst({
        where: {
          email: { equals: e.email, mode: "insensitive" },
          fromAbandonedForm: false,
          id: { not: e.leadId },
        },
      });
      if (completed) {
        await stopEnrollment(e.id, "converted", "converted");
        stopped++;
        continue;
      }

      if (await sendNextRecaptureEmail(e.id)) sent++;
    } catch (err) {
      logger.error("RECAPTURE", "Queue item failed", {
        enrollmentId: e.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { due: due.length, sent, stopped };
}

async function stopEnrollment(id: string, reason: string, status: string = "stopped") {
  await prisma.recaptureEnrollment.update({
    where: { id },
    data: { status, stopReason: reason, nextSendAt: null },
  });
}

/** Stop the sequence for a lead (team touched it, outcome recorded, etc.). */
export async function stopRecaptureForLead(leadId: string, reason: string): Promise<void> {
  await prisma.recaptureEnrollment
    .updateMany({
      where: { leadId, status: "active" },
      data: { status: "stopped", stopReason: reason, nextSendAt: null },
    })
    .catch(() => {});
}

/** Mark enrollments converted when the same person completes the form. */
export async function markRecaptureConverted(email: string | null, sessionId: string | null): Promise<void> {
  const or: Array<Record<string, unknown>> = [];
  if (email) or.push({ email: email.trim().toLowerCase() });
  if (sessionId) or.push({ sessionId });
  if (or.length === 0) return;
  await prisma.recaptureEnrollment
    .updateMany({
      where: { status: "active", OR: or as never },
      data: { status: "converted", stopReason: "form_completed", nextSendAt: null },
    })
    .catch(() => {});
}

/** Resolve a resume token to the saved form state (for the restore API). */
export async function resolveResumeToken(token: string): Promise<
  | { ok: true; sessionId: string | null; fields: Record<string, unknown>; step: string | null }
  | { ok: false; error: "not_found" | "expired" }
> {
  // Edit tokens (from confirmation emails, completed submissions): stateless,
  // land the prospect at the start of the form with everything prefilled.
  if (token.startsWith("e.")) {
    const sessionId = verifyEditToken(token);
    if (!sessionId) return { ok: false, error: "not_found" };
    const queueRow = await prisma.ingestionQueue.findFirst({
      where: { sessionId },
      orderBy: { receivedAt: "desc" },
    });
    if (!queueRow) return { ok: false, error: "not_found" };
    const payload = (queueRow.rawPayload as Record<string, unknown> | null) ?? {};
    if (queueRow.leadId) {
      await prisma.leadEvent
        .create({
          data: { leadId: queueRow.leadId, eventType: "edit_link_opened", eventDataJson: {} },
        })
        .catch(() => {});
    }
    return {
      ok: true,
      sessionId,
      fields: (payload.fields as Record<string, unknown>) ?? {},
      step: "form_opened",
    };
  }

  const enrollment = await prisma.recaptureEnrollment.findUnique({
    where: { resumeToken: token },
    include: { lead: true },
  });
  if (!enrollment) return { ok: false, error: "not_found" };

  const ageDays = (Date.now() - enrollment.createdAt.getTime()) / 86400000;
  if (ageDays > 30) return { ok: false, error: "expired" };

  let fields: Record<string, unknown> = {};
  let step: string | null = enrollment.abandonedStep;

  if (enrollment.sessionId) {
    const queueRow = await prisma.ingestionQueue.findFirst({
      where: { sessionId: enrollment.sessionId },
      orderBy: { receivedAt: "desc" },
    });
    const payload = (queueRow?.rawPayload as Record<string, unknown> | null) ?? {};
    fields = (payload.fields as Record<string, unknown>) ?? {};
    step = (queueRow?.partialStep as string | null) ?? step;
  }

  await prisma.leadEvent
    .create({
      data: {
        leadId: enrollment.leadId,
        eventType: "recapture_link_opened",
        eventDataJson: { step },
      },
    })
    .catch(() => {});

  return { ok: true, sessionId: enrollment.sessionId, fields, step };
}
