"use server";

// Pre-creates a client profile in the acb-onboarding tool for a lead, so the
// "sign our Collection Agreement" email can link straight to a portal that
// already has their info. Calls the onboarding service with a shared key;
// welcome email is suppressed because Noah sends his own personal note.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logEvent } from "@/services/activity-log.service";
import { revalidatePath } from "next/cache";

export async function createOnboardingProfile(
  leadId: string
): Promise<{ success: boolean; portalUrl?: string; error?: string }> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const key = process.env.ONBOARDING_SERVICE_KEY;
  if (!key) {
    return { success: false, error: "ONBOARDING_SERVICE_KEY is not configured" };
  }
  const base = process.env.ONBOARDING_API_URL ?? "https://onboard.advancedcb.com";

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  try {
    const res = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ACB-Service-Key": key,
      },
      body: JSON.stringify({
        company_name: lead.companyName ?? "",
        contact_name: lead.fullName ?? "",
        contact_email: lead.email ?? "",
        contact_phone: lead.phone ?? "",
        mgmt_type: "",
        suppress_welcome: true,
      }),
    });

    if (!res.ok) {
      return { success: false, error: `Onboarding service returned ${res.status}` };
    }

    const data = (await res.json()) as { portal_url?: string; token?: string };
    const portalUrl = data.portal_url ?? (data.token ? `${base}/o/${data.token}` : undefined);
    if (!portalUrl) return { success: false, error: "No portal URL returned" };

    await logEvent(leadId, "onboarding_profile_created", { portalUrl }, session.user.id);
    await prisma.leadNote.create({
      data: {
        leadId,
        userId: session.user.id,
        noteBody: `Onboarding profile created. Portal link: ${portalUrl}`,
      },
    });

    revalidatePath(`/leads/${leadId}`);
    return { success: true, portalUrl };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not reach the onboarding service",
    };
  }
}
