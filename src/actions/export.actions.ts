"use server";

import { auth } from "@/lib/auth";
import { exportLeadsForCrm } from "@/services/crm-export.service";

export async function exportLeadsCsv(leadIds: string[]) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  if (leadIds.length === 0) throw new Error("No leads selected");

  const result = await exportLeadsForCrm(leadIds, session.user.id);
  return result.csv;
}
