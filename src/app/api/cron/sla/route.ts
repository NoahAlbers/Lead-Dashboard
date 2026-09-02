import { NextResponse } from "next/server";
import { recalculateAllSlas } from "@/services/sla.service";
import { prisma } from "@/lib/db";
import { createNotification } from "@/services/notification.service";
import { logEvent } from "@/services/activity-log.service";

/** Fire "follow-up due" notifications for reminders that just came due. */
async function notifyDueFollowUps() {
  const due = await prisma.followUpReminder.findMany({
    where: { completed: false, notifiedAt: null, reminderAt: { lte: new Date() } },
    include: { lead: { select: { id: true, companyName: true, fullName: true, qualityTier: true, score: true } } },
    take: 100,
  });
  let notified = 0;
  for (const r of due) {
    const label = r.lead.companyName || r.lead.fullName || "Lead";
    const hot = (r.lead.score ?? 0) >= 80;
    await createNotification(
      r.userId,
      "follow_up_due",
      `Follow up with ${label}`,
      r.note ? r.note : `Scheduled follow-up is due now${r.lead.qualityTier ? ` (${r.lead.qualityTier})` : ""}.`,
      r.leadId,
      hot ? "HIGH" : "NORMAL"
    ).catch(() => {});
    await prisma.followUpReminder.update({ where: { id: r.id }, data: { notifiedAt: new Date() } });
    await logEvent(r.leadId, "follow_up_due", { reminderId: r.id }).catch(() => {});
    notified++;
  }
  return notified;
}

export async function POST(request: Request) {
  // Verify cron secret
  const secret = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace("Bearer ", "");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await recalculateAllSlas();
    const followUpsNotified = await notifyDueFollowUps().catch((err) => {
      console.error("Follow-up notifications failed:", err);
      return 0;
    });
    return NextResponse.json({ success: true, ...result, followUpsNotified });
  } catch (error) {
    console.error("SLA recalculation failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Also allow GET for Vercel Cron
export async function GET(request: Request) {
  return POST(request);
}
