"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { runAutoResearch, type AutoResearchResult, type FoundProfile } from "@/services/research.service";

export type { AutoResearchResult, FoundProfile };

export async function autoResearchLead(leadId: string): Promise<AutoResearchResult> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const result = await runAutoResearch(leadId, session.user.id);
  revalidatePath(`/leads/${leadId}`);
  return result;
}
