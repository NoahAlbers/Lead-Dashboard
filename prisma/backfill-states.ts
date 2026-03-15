import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    select: { id: true, state: true, rawPayloadJson: true, states: true },
  });

  let updated = 0;
  for (const lead of leads) {
    // Skip if already has states array
    if (lead.states && Array.isArray(lead.states) && (lead.states as string[]).length > 0) continue;

    // Try to extract from rawPayloadJson._rawIntakeForm.states
    const raw = lead.rawPayloadJson as Record<string, unknown> | null;
    const intake = (raw?._rawIntakeForm as Record<string, unknown>) ?? raw;
    const statesArray = intake?.states as string[] | undefined;

    if (statesArray && Array.isArray(statesArray) && statesArray.length > 0) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { states: statesArray },
      });
      console.log(`  ${lead.id}: set states = [${statesArray.join(", ")}]`);
      updated++;
    } else if (lead.state) {
      // Fallback: use the single state field
      await prisma.lead.update({
        where: { id: lead.id },
        data: { states: [lead.state] },
      });
      console.log(`  ${lead.id}: set states = [${lead.state}] (from single state field)`);
      updated++;
    }
  }

  console.log(`Backfilled states for ${updated} of ${leads.length} leads`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
