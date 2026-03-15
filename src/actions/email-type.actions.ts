"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getEmailTypes() {
  return prisma.emailType.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function createEmailType(data: { name: string; color: string; isReferral: boolean }) {
  const maxOrder = await prisma.emailType.aggregate({ _max: { sortOrder: true } });
  await prisma.emailType.create({
    data: {
      name: data.name,
      color: data.color,
      isReferral: data.isReferral,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/templates");
}

export async function updateEmailType(id: string, data: { name?: string; color?: string; isReferral?: boolean }) {
  await prisma.emailType.update({ where: { id }, data });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/templates");
}

export async function deleteEmailType(id: string) {
  // Unlink templates first
  await prisma.emailTemplate.updateMany({ where: { emailTypeId: id }, data: { emailTypeId: null } });
  await prisma.emailType.delete({ where: { id } });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/templates");
}
