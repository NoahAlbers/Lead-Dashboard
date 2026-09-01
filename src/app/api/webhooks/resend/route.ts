import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { suppressEmail } from "@/lib/acb-email";
import { logger } from "@/lib/logger";

// Resend event webhook: records delivery engagement on the lead timeline and
// auto-suppresses addresses that bounce or complain. Configure in Resend as
//   https://<app>/api/webhooks/resend?key=<WEBHOOK_SECRET>
// (the key query param stands in for svix signature verification).

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const expected = process.env.RESEND_WEBHOOK_KEY ?? process.env.WEBHOOK_SECRET;
  if (expected && key !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { type?: string; data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = body.type ?? "";
  const data = body.data ?? {};
  const toRaw = data.to;
  const to = Array.isArray(toRaw) ? String(toRaw[0] ?? "") : String(toRaw ?? "");
  const email = to.trim().toLowerCase();

  if (!email) return NextResponse.json({ ok: true });

  if (type === "email.bounced") {
    await suppressEmail(email, "bounced", "resend_webhook");
  } else if (type === "email.complained") {
    await suppressEmail(email, "complained", "resend_webhook");
  }

  // Attach engagement to the lead timeline when we know the lead.
  const interesting = ["email.bounced", "email.complained", "email.opened", "email.clicked", "email.delivered"];
  if (interesting.includes(type)) {
    const lead = await prisma.lead.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (lead) {
      await prisma.leadEvent.create({
        data: {
          leadId: lead.id,
          eventType: `email_${type.replace("email.", "")}`,
          eventDataJson: { subject: (data.subject as string) ?? null, to: email },
        },
      }).catch(() => {});
    }
  }

  logger.info("RESEND_WEBHOOK", "Event processed", { type, email });
  return NextResponse.json({ ok: true });
}
