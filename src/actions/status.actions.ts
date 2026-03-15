"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getCustomStatuses(type?: string) {
  const where = type ? { type } : {};
  return prisma.customStatus.findMany({
    where,
    orderBy: { sortOrder: "asc" },
  });
}

export async function createCustomStatus(data: {
  name: string;
  color: string;
  type: string;
}) {
  const maxOrder = await prisma.customStatus.aggregate({
    where: { type: data.type },
    _max: { sortOrder: true },
  });

  await prisma.customStatus.create({
    data: {
      name: data.name,
      color: data.color,
      type: data.type,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/admin/settings");
}

export async function updateCustomStatus(
  id: string,
  data: { name?: string; color?: string; sortOrder?: number }
) {
  await prisma.customStatus.update({
    where: { id },
    data,
  });

  revalidatePath("/admin/settings");
}

export async function deleteCustomStatus(id: string) {
  await prisma.customStatus.delete({
    where: { id },
  });

  revalidatePath("/admin/settings");
}
