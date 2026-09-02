import { prisma } from "@/lib/db";
import { leadWebDomain } from "@/lib/lead-domain";

interface DuplicateMatch {
  leadId: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  matchReasons: string[];
}

export async function findDuplicates(lead: {
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  fullName?: string | null;
}): Promise<DuplicateMatch[]> {
  const conditions = [];

  if (lead.email?.trim()) {
    conditions.push({ email: { equals: lead.email.trim(), mode: "insensitive" as const } });
  }
  if (lead.phone?.trim()) {
    const normalized = lead.phone.replace(/\D/g, "");
    conditions.push({ phone: { contains: normalized.slice(-10) } });
  }
  if (lead.companyName?.trim()) {
    conditions.push({
      companyName: { equals: lead.companyName.trim(), mode: "insensitive" as const },
    });
  }
  // Same business email domain (personal-mail domains excluded) usually means
  // the same company reaching out twice.
  const domain = lead.email ? leadWebDomain(null, lead.email) : null;
  if (domain && lead.email?.includes("@")) {
    conditions.push({ email: { endsWith: `@${domain}`, mode: "insensitive" as const } });
  }

  if (conditions.length === 0) return [];

  const matches = await prisma.lead.findMany({
    where: { OR: conditions },
    select: {
      id: true,
      companyName: true,
      email: true,
      phone: true,
      fullName: true,
    },
    take: 10,
  });

  return matches.map((match) => {
    const reasons: string[] = [];
    if (
      lead.email &&
      match.email &&
      lead.email.toLowerCase() === match.email.toLowerCase()
    ) {
      reasons.push("Same email");
    }
    if (lead.phone && match.phone) {
      const normLead = lead.phone.replace(/\D/g, "");
      const normMatch = match.phone.replace(/\D/g, "");
      if (normLead.slice(-10) === normMatch.slice(-10)) {
        reasons.push("Same phone");
      }
    }
    if (
      lead.companyName &&
      match.companyName &&
      lead.companyName.toLowerCase() === match.companyName.toLowerCase()
    ) {
      reasons.push("Same company");
    }
    return {
      leadId: match.id,
      companyName: match.companyName,
      email: match.email,
      phone: match.phone,
      matchReasons: reasons,
    };
  });
}
