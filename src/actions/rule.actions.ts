"use server";

import { prisma } from "@/lib/db";
import { auth, assertRole } from "@/lib/auth";
import { scoringRuleSchema } from "@/lib/validators/admin";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { scoreAndUpdateLead } from "@/services/scoring.service";

async function recalculateAllLeads() {
  const leads = await prisma.lead.findMany({
    where: { status: { notIn: ["ARCHIVED", "DISQUALIFIED"] } },
    select: { id: true },
  });

  for (const lead of leads) {
    await scoreAndUpdateLead(lead.id);
  }

  revalidatePath("/leads");
  return leads.length;
}

export async function getRules() {
  return prisma.scoringRule.findMany({ orderBy: { priority: "asc" } });
}

export async function createRule(data: unknown) {
  const session = await auth();
  assertRole(session, "ADMIN");

  const parsed = scoringRuleSchema.parse(data);

  const rule = await prisma.scoringRule.create({
    data: {
      ...parsed,
      conditionsJson: parsed.conditionsJson as unknown as Prisma.InputJsonValue,
      outcomesJson: parsed.outcomesJson as unknown as Prisma.InputJsonValue,
    },
  });

  const count = await recalculateAllLeads();

  revalidatePath("/admin/rules");
  return { rule, recalculatedCount: count };
}

export async function updateRule(id: string, data: unknown) {
  const session = await auth();
  assertRole(session, "ADMIN");

  const parsed = scoringRuleSchema.parse(data);

  const rule = await prisma.scoringRule.update({
    where: { id },
    data: {
      ...parsed,
      conditionsJson: parsed.conditionsJson as unknown as Prisma.InputJsonValue,
      outcomesJson: parsed.outcomesJson as unknown as Prisma.InputJsonValue,
    },
  });

  const count = await recalculateAllLeads();

  revalidatePath("/admin/rules");
  return { rule, recalculatedCount: count };
}

export async function deleteRule(id: string) {
  const session = await auth();
  assertRole(session, "ADMIN");

  await prisma.scoringRule.delete({ where: { id } });

  const count = await recalculateAllLeads();

  revalidatePath("/admin/rules");
  return { recalculatedCount: count };
}

export async function toggleRule(id: string, enabled: boolean) {
  const session = await auth();
  assertRole(session, "ADMIN");

  await prisma.scoringRule.update({ where: { id }, data: { enabled } });

  const count = await recalculateAllLeads();

  revalidatePath("/admin/rules");
  return { recalculatedCount: count };
}

/**
 * Persists a new rule order. Each rule's priority becomes its index in `orderedIds`.
 * Leads are recalculated because priority order affects which hard stop wins.
 */
export async function reorderRules(orderedIds: string[]) {
  const session = await auth();
  assertRole(session, "ADMIN");

  const ids = Array.from(new Set(orderedIds.filter((id) => typeof id === "string" && id.length > 0)));
  if (ids.length === 0) return { recalculatedCount: 0 };

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.scoringRule.update({ where: { id }, data: { priority: index } })
    )
  );

  const count = await recalculateAllLeads();

  revalidatePath("/admin/rules");
  return { recalculatedCount: count };
}
