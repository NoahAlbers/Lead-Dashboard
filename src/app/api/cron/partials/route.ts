import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processIngestionItem } from "@/services/ingestion-pipeline.service";
import { createNotificationsForRole } from "@/services/notification.service";
import { enrollAbandonedLead } from "@/services/recapture.service";

// Vercel Pro allows up to 300s; the loop below stops early to stay inside it.
export const maxDuration = 300;
const TIME_BUDGET_MS = 240_000;

async function processAbandonedPartials() {
  // 1. Read timeout from SystemConfig (default 60 minutes)
  const config = await prisma.systemConfig.findUnique({
    where: { key: "partial_lead_timeout_minutes" },
  });
  const timeoutMinutes =
    config && typeof config.value === "number"
      ? config.value
      : typeof config?.value === "object" && config.value !== null
        ? Number(config.value)
        : 60;

  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

  // 2. Find abandoned partials that haven't been processed yet
  const abandonedPartials = await prisma.ingestionQueue.findMany({
    where: {
      isPartial: true,
      status: "partial",
      receivedAt: { lt: cutoff },
    },
    orderBy: { receivedAt: "asc" },
    take: 1500,
  });

  const startedAt = Date.now();
  let processed = 0;
  let failed = 0;
  // Rows with no email or phone can never become leads; they're skipped, not failed.
  let skipped = 0;
  const errors: string[] = [];

  for (const item of abandonedPartials) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break; // the next run picks up the rest
    try {
      // Reset status to "received" so processIngestionItem will pick it up
      // Also remove isPartial flag so it won't be picked up again
      await prisma.ingestionQueue.update({
        where: { id: item.id },
        data: { status: "received", isPartial: false },
      });

      // Process through the pipeline (validates email/phone, creates lead, scores, notifies)
      await processIngestionItem(item.id);

      // Check if the lead was created successfully
      const updated = await prisma.ingestionQueue.findUnique({
        where: { id: item.id },
      });

      if (updated?.status === "completed" && updated.leadId) {
        // Add a note to the lead about partial submission
        // Find any admin/system user to attribute the note
        const systemUser = await prisma.user.findFirst({
          where: { role: "ADMIN", active: true },
          select: { id: true },
        });

        if (systemUser) {
          const partialStep = item.partialStep ?? "unknown";
          await prisma.leadNote.create({
            data: {
              leadId: updated.leadId,
              userId: systemUser.id,
              noteBody: `This lead started the intake form but did not complete it. Last step completed: ${partialStep}`,
            },
          });
        }

        // Flag as an abandoned-form lead (drives the Abandons inbox tab) and
        // date it from when the visitor actually walked away (last activity
        // plus the abandon timeout), not from when this job ran.
        const lastActivity = item.lastHeartbeatAt ?? item.receivedAt;
        const abandonedAt = new Date(Math.min(Date.now(), lastActivity.getTime() + timeoutMinutes * 60 * 1000));
        await prisma.lead.update({
          where: { id: updated.leadId },
          data: { fromAbandonedForm: true, createdAt: abandonedAt },
        });
        await enrollAbandonedLead(updated.leadId, item.sessionId, item.partialStep, item.receivedAt).catch((err) => {
          console.error("Recapture enrollment failed (non-blocking):", err);
        });

        processed++;
      } else if (updated?.status === "failed") {
        if ((updated.errorMessage ?? "").startsWith("Validation failed")) {
          skipped++;
        } else {
          failed++;
          errors.push(
            `${item.submissionId}: ${updated.errorMessage ?? "Unknown error"}`
          );
        }
      }
    } catch (error) {
      failed++;
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${item.submissionId}: ${msg}`);

      // Make sure the item is marked as failed so it doesn't get retried endlessly
      await prisma.ingestionQueue
        .update({
          where: { id: item.id },
          data: {
            status: "failed",
            errorMessage: `Partial conversion failed: ${msg}`.slice(0, 2000),
            retryCount: { increment: 1 },
          },
        })
        .catch(() => {});
    }
  }

  // Notify admins when something happened worth a look: new abandoned-form
  // leads, or a real processing error. Skipped rows (no contact info) are
  // silent; they're expected and nobody can act on them.
  if (processed > 0 || failed > 0) {
    await createNotificationsForRole(
      "ADMIN",
      "system_alert",
      processed > 0 ? "Abandoned forms turned into leads" : "Abandoned form processing needs attention",
      `${processed > 0 ? `${processed} abandoned form${processed !== 1 ? "s" : ""} now in the Abandoned tab.` : ""}${failed > 0 ? ` ${failed} could not be processed; see Ingestion Health.` : ""}`.trim(),
      null,
      failed > 0 ? "HIGH" : "NORMAL"
    ).catch(() => {});
  }

  return {
    found: abandonedPartials.length,
    processed,
    skipped,
    failed,
    errors: errors.slice(0, 10),
    timeoutMinutes,
  };
}

export async function POST(request: Request) {
  // Verify cron secret
  const secret =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace("Bearer ", "");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processAbandonedPartials();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Partial lead processing failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Also allow GET for Vercel Cron
export async function GET(request: Request) {
  return POST(request);
}
