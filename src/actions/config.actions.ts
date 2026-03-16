"use server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getSystemConfig(key: string) {
  const config = await prisma.systemConfig.findUnique({ where: { key } });
  return config?.value ?? null;
}

export async function updateSystemConfig(key: string, value: unknown) {
  const session = await auth();
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value: value as any },
    create: { key, value: value as any },
  });
  revalidatePath("/leads");
  revalidatePath("/admin/settings");
}
