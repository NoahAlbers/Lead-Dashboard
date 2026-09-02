"use server";

// Hands a lead to the acb-onboarding tool. The dialog on the lead page lets
// the team correct the details first and choose whether the onboarding
// service emails the client their portal link right away.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logEvent } from "@/services/activity-log.service";
import { revalidatePath } from "next/cache";

export type MgmtType = "owner_operator" | "third_party" | "";

export interface OnboardingInput {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  mgmtType: MgmtType;
  /** true: the onboarding service sends its welcome email with the portal link. */
  sendEmail: boolean;
}

export interface OnboardingResult {
  success: boolean;
  portalUrl?: string;
  emailed?: boolean;
  error?: string;
}

export async function createOnboardingProfile(leadId: string, input: OnboardingInput): Promise<OnboardingResult> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const key = process.env.ONBOARDING_SERVICE_KEY;
  if (!key) {
    return { success: false, error: "The onboarding service key is not configured (ONBOARDING_SERVICE_KEY)." };
  }
  // The onboarding tool lives at onboarding.advancedcb.com (onboard.advancedcb.com has no DNS record).
  const base = (process.env.ONBOARDING_API_URL ?? "https://onboarding.advancedcb.com").replace(/\/+$/, "");

  const email = input.email.trim().toLowerCase();
  if (input.sendEmail && !email) {
    return { success: false, error: "Add an email address, or choose Create only." };
  }

  try {
    const res = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-ACB-Service-Key": key },
      body: JSON.stringify({
        company_name: input.companyName.trim(),
        contact_name: input.contactName.trim(),
        contact_email: email,
        contact_phone: input.phone.trim(),
        mgmt_type: input.mgmtType,
        suppress_welcome: !input.sendEmail,
        // Lets the onboarding tool report milestones back to this lead.
        lead_id: leadId,
      }),
    });

    if (!res.ok) {
      return { success: false, error: `The onboarding service answered ${res.status}. Nothing was created.` };
    }

    const data = (await res.json()) as { portal_url?: string; token?: string };
    const portalUrl = data.portal_url ?? (data.token ? `${base}/o/${data.token}` : undefined);
    if (!portalUrl) return { success: false, error: "The onboarding service didn't return a portal link." };

    await logEvent(
      leadId,
      "onboarding_profile_created",
      {
        portalUrl,
        token: data.token ?? null,
        emailed: input.sendEmail,
        sent: {
          companyName: input.companyName.trim(),
          contactName: input.contactName.trim(),
          email,
          phone: input.phone.trim(),
          mgmtType: input.mgmtType,
        },
      },
      session.user.id
    );
    await prisma.leadNote.create({
      data: {
        leadId,
        userId: session.user.id,
        noteBody: `Onboarding portal created${input.sendEmail ? ` and emailed to ${email}` : " (no email sent)"}. Link: ${portalUrl}`,
      },
    });
    await prisma.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } });

    revalidatePath(`/leads/${leadId}`);
    return { success: true, portalUrl, emailed: input.sendEmail };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? `Could not reach the onboarding service: ${err.message}` : "Could not reach the onboarding service",
    };
  }
}
