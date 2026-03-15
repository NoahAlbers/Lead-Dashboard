"use server";

import { prisma } from "@/lib/db";
import { auth, assertRole } from "@/lib/auth";
import { emailTemplateSchema } from "@/lib/validators/admin";
import { revalidatePath } from "next/cache";

export async function getTemplates() {
  return prisma.emailTemplate.findMany({ orderBy: { name: "asc" } });
}

export async function getTemplate(id: string) {
  return prisma.emailTemplate.findUnique({ where: { id } });
}

export async function createTemplate(data: unknown) {
  const session = await auth();
  assertRole(session, "ADMIN");

  const parsed = emailTemplateSchema.parse(data);

  const template = await prisma.emailTemplate.create({
    data: {
      ...parsed,
      createdByUserId: session.user.id,
    },
  });
  revalidatePath("/admin/templates");
  return template;
}

export async function updateTemplate(id: string, data: unknown) {
  const session = await auth();
  assertRole(session, "ADMIN");

  const parsed = emailTemplateSchema.parse(data);

  const template = await prisma.emailTemplate.update({
    where: { id },
    data: parsed,
  });
  revalidatePath("/admin/templates");
  return template;
}

export async function deleteTemplate(id: string) {
  const session = await auth();
  assertRole(session, "ADMIN");

  await prisma.emailTemplate.delete({ where: { id } });
  revalidatePath("/admin/templates");
}
