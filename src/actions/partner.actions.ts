"use server";

import { prisma } from "@/lib/db";
import { auth, assertRole } from "@/lib/auth";
import { referralPartnerSchema } from "@/lib/validators/admin";
import { revalidatePath } from "next/cache";

export async function getPartners() {
  return prisma.referralPartner.findMany({ orderBy: { rankingPriority: "asc" } });
}

export async function getActivePartners() {
  const partners = await prisma.referralPartner.findMany({
    where: { active: true },
    orderBy: { rankingPriority: "asc" },
    include: {
      defaultEmailTemplate: {
        select: { id: true, name: true, type: true, subjectTemplate: true, bodyTemplate: true },
      },
    },
  });
  return partners.map((p) => ({
    id: p.id,
    name: p.name,
    contactName: p.contactName,
    email: p.email,
    emails: p.emails as string[] | null,
    phone: p.phone,
    website: p.website,
    statesServed: p.statesServedJson as string[] | null,
    specialties: p.specialtiesJson as string[] | null,
    industries: p.industriesServedJson as string[] | null,
    minimumClaimSize: p.minimumClaimSize ? Number(p.minimumClaimSize) : null,
    maximumClaimSize: p.maximumClaimSize ? Number(p.maximumClaimSize) : null,
    notes: p.notes,
    // Financial Terms
    contingencyRate: p.contingencyRate,
    upfrontCosts: p.upfrontCosts,
    paymentTerms: p.paymentTerms,
    commissionStructure: p.commissionStructure,
    // Account Requirements
    minimumAccounts: p.minimumAccounts,
    minimumTotalBalance: p.minimumTotalBalance ? Number(p.minimumTotalBalance) : null,
    avgAccountAgePref: p.avgAccountAgePref,
    accountTypesAccepted: p.accountTypesAccepted,
    // Service Details
    collectionMethods: p.collectionMethods,
    licensedStates: p.licensedStatesJson as string[] | null,
    insuranceInfo: p.insuranceInfo,
    yearsInBusiness: p.yearsInBusiness,
    complianceNotes: p.complianceNotes,
    // Per-partner email template (used by the referral compose flow when set)
    defaultEmailTemplate: p.defaultEmailTemplate,
  }));
}

export async function getPartner(id: string) {
  return prisma.referralPartner.findUnique({ where: { id } });
}

export async function createPartner(data: unknown) {
  const session = await auth();
  assertRole(session, "ADMIN");

  const parsed = referralPartnerSchema.parse(data);

  const partner = await prisma.referralPartner.create({
    data: {
      ...parsed,
      minimumClaimSize: parsed.minimumClaimSize ?? undefined,
      maximumClaimSize: parsed.maximumClaimSize ?? undefined,
    },
  });
  revalidatePath("/admin/partners");
  return partner;
}

export async function updatePartner(id: string, data: unknown) {
  const session = await auth();
  assertRole(session, "ADMIN");

  const parsed = referralPartnerSchema.parse(data);

  const partner = await prisma.referralPartner.update({
    where: { id },
    data: {
      ...parsed,
      minimumClaimSize: parsed.minimumClaimSize ?? undefined,
      maximumClaimSize: parsed.maximumClaimSize ?? undefined,
    },
  });
  revalidatePath("/admin/partners");
  return partner;
}

export async function deletePartner(id: string) {
  const session = await auth();
  assertRole(session, "ADMIN");

  await prisma.referralPartner.delete({ where: { id } });
  revalidatePath("/admin/partners");
}
