"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stopRecaptureForLead } from "@/services/recapture.service";
import { revalidatePath } from "next/cache";

export async function stopRecaptureManually(leadId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  await stopRecaptureForLead(leadId, `stopped_by_${session.user.name ?? "staff"}`);
  await prisma.leadEvent.create({
    data: {
      leadId,
      eventType: "recapture_stopped",
      eventDataJson: { by: session.user.name ?? session.user.email ?? "staff" },
    },
  });
  revalidatePath(`/leads/${leadId}`);
}
