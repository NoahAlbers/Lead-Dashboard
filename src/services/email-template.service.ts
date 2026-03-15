import { prisma } from "@/lib/db";
import type { Lead } from "@prisma/client";

interface MergeData {
  lead: Lead;
  assignedUserName?: string;
  referralPartnerName?: string;
}

function renderTemplate(template: string, data: MergeData): string {
  const { lead } = data;
  const replacements: Record<string, string> = {
    "{{full_name}}": lead.fullName ?? `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() ?? "there",
    "{{first_name}}": lead.firstName ?? "",
    "{{last_name}}": lead.lastName ?? "",
    "{{company_name}}": lead.companyName ?? "",
    "{{email}}": lead.email ?? "",
    "{{phone}}": lead.phone ?? "",
    "{{state}}": lead.state ?? "",
    "{{industry}}": lead.industry ?? "",
    "{{balance_amount}}": lead.balanceAmount ? `$${Number(lead.balanceAmount).toLocaleString()}` : "",
    "{{notes_from_form}}": lead.notesFromForm ?? "",
    "{{assigned_user_name}}": data.assignedUserName ?? "ACB Team",
    "{{referral_partner_name}}": data.referralPartnerName ?? "",
    "{{debt_type}}": lead.debtType ?? "",
    "{{service_requested}}": lead.serviceRequested ?? "",
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

export async function renderEmailTemplate(
  templateId: string,
  data: MergeData
): Promise<{ subject: string; body: string } | null> {
  const template = await prisma.emailTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template || !template.active) return null;

  return {
    subject: renderTemplate(template.subjectTemplate, data),
    body: renderTemplate(template.bodyTemplate, data),
  };
}

export async function getTemplatesByType(type: string) {
  return prisma.emailTemplate.findMany({
    where: { type, active: true },
    orderBy: { name: "asc" },
  });
}

export function buildMailtoLink(
  to: string,
  subject: string,
  body: string
): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
