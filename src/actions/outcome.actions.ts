"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Create an outcome for a lead
export async function createOutcome(leadId: string, data: {
  outcomeType: string;
  reason: string;
  reasonDetail?: string;
  competitor?: string;
  couldHaveWon?: string;
  estimatedValue?: number;
  estimatedAnnualRevenue?: number;
  accountVolume?: number;
  referralPartnerId?: string;
  notes?: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  await prisma.leadOutcome.upsert({
    where: { leadId },
    update: { ...data, outcomeDate: new Date(), recordedByUserId: session.user.id },
    create: { leadId, ...data, outcomeDate: new Date(), recordedByUserId: session.user.id },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/reports");
}

// Get outcome for a lead
export async function getOutcome(leadId: string) {
  return prisma.leadOutcome.findUnique({
    where: { leadId },
    include: { referralPartner: { select: { id: true, name: true } } },
  });
}

// Get reason configs for a specific outcome type
export async function getOutcomeReasonConfigs(outcomeType?: string) {
  return prisma.outcomeReasonConfig.findMany({
    where: outcomeType ? { outcomeType, active: true } : { active: true },
    orderBy: [{ outcomeType: "asc" }, { sortOrder: "asc" }],
  });
}

// Admin: upsert a reason config
export async function upsertOutcomeReasonConfig(data: { id?: string; outcomeType: string; reasonText: string; sortOrder?: number }) {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) throw new Error("Unauthorized");

  if (data.id) {
    return prisma.outcomeReasonConfig.update({
      where: { id: data.id },
      data: { reasonText: data.reasonText, sortOrder: data.sortOrder ?? 0 },
    });
  }
  return prisma.outcomeReasonConfig.create({ data: { outcomeType: data.outcomeType, reasonText: data.reasonText, sortOrder: data.sortOrder ?? 0 } });
}

// Admin: toggle active status
export async function toggleOutcomeReasonConfig(id: string, active: boolean) {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) throw new Error("Unauthorized");
  await prisma.outcomeReasonConfig.update({ where: { id }, data: { active } });
}
