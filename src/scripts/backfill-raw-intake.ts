import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function backfill() {
  const events = await prisma.leadEvent.findMany({
    where: { eventType: "lead_data_received" },
  });

  let updated = 0;
  let skipped = 0;

  for (const event of events) {
    const data = event.eventDataJson as Record<string, unknown> | null;
    if (!data) {
      skipped++;
      continue;
    }

    const fields = data.fields as Record<string, unknown> | undefined;
    if (!fields?._rawIntakeForm) {
      skipped++;
      continue;
    }

    await prisma.leadEvent.update({
      where: { id: event.id },
      data: {
        eventDataJson: {
          fields: fields._rawIntakeForm,
          metadata: (data.metadata as Record<string, unknown>) ?? {},
        } as unknown as Prisma.InputJsonValue,
      },
    });
    updated++;
  }

  console.log(
    `Backfill complete: ${updated} updated, ${skipped} skipped (no _rawIntakeForm), ${events.length} total`
  );
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
