"use server";

import { prisma } from "@/lib/db";
import { auth, assertRole } from "@/lib/auth";
import { scoringRuleSchema } from "@/lib/validators/admin";
import { revalidatePath } from "next/cache";

export async function getRules() {
  return prisma.scoringRule.findMany({ orderBy: { priority: "asc" } });
}

export async function createRule(data: unknown) {
  const session = await auth();
  assertRole(session, "ADMIN");

  const parsed = scoringRuleSchema.parse(data);

  const rule = await prisma.scoringRule.create({ data: parsed });
  revalidatePath("/admin/rules");
  return rule;
}

export async function updateRule(id: string, data: unknown) {
  const session = await auth();
  assertRole(session, "ADMIN");

  const parsed = scoringRuleSchema.parse(data);

  const rule = await prisma.scoringRule.update({
    where: { id },
    data: parsed,
  });
  revalidatePath("/admin/rules");
  return rule;
}

export async function deleteRule(id: string) {
  const session = await auth();
  assertRole(session, "ADMIN");

  await prisma.scoringRule.delete({ where: { id } });
  revalidatePath("/admin/rules");
}

export async function toggleRule(id: string, enabled: boolean) {
  const session = await auth();
  assertRole(session, "ADMIN");

  await prisma.scoringRule.update({ where: { id }, data: { enabled } });
  revalidatePath("/admin/rules");
}
