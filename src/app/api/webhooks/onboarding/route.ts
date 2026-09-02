import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createNotification, createNotificationsForRole } from "@/services/notification.service";

// Milestones from the acb-onboarding tool land on the lead timeline.
// Configure the onboarding service with:
//   LEAD_CONSOLE_WEBHOOK_URL=https://<app>/api/webhooks/onboarding
//   LEAD_CONSOLE_WEBHOOK_KEY=<same value as ONBOARDING_WEBHOOK_KEY here>
// Payload: { event, lead_id?, token, portal_url?, company_name?, contact_email?, detail?, at }
// Events: portal_opened, mgmt_type_chosen, entity_added, agreement_signed, onboarding_complete

const MILESTONE_LABELS: Record<string, string> = {
  portal_opened: "Opened their onboarding portal",
  mgmt_type_chosen: "Chose their management type",
  entity_added: "Added a property or entity",
  document_uploaded: "Uploaded a document",
  agreement_signed: "Signed the collection agreement",
  onboarding_complete: "Finished onboarding",
};

export async function POST(req: NextRequest) {
  const expected = process.env.ONBOARDING_WEBHOOK_KEY ?? process.env.WEBHOOK_SECRET;
  const provided = req.headers.get("x-acb-service-key") ?? req.nextUrl.searchParams.get("key");
  if (expected && provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = String(body.event ?? "");
  if (!event) return NextResponse.json({ error: "Missing event" }, { status: 400 });
  const token = typeof body.token === "string" ? body.token : null;
  const leadIdHint = typeof body.lead_id === "string" ? body.lead_id : null;
  const contactEmail = typeof body.contact_email === "string" ? body.contact_email.trim().toLowerCase() : null;

  // Find the lead: explicit id, then the token stored at creation, then email.
  let lead = leadIdHint ? await prisma.lead.findUnique({ where: { id: leadIdHint } }) : null;
  if (!lead && token) {
    const created = await prisma.leadEvent.findFirst({
      where: { eventType: "onboarding_profile_created", eventDataJson: { path: ["token"], equals: token } },
      orderBy: { createdAt: "desc" },
      select: { leadId: true },
    });
    if (created) lead = await prisma.lead.findUnique({ where: { id: created.leadId } });
  }
  if (!lead && contactEmail) {
    lead = await prisma.lead.findFirst({
      where: { email: { equals: contactEmail, mode: "insensitive" }, status: { notIn: ["ARCHIVED", "MERGED"] } },
      orderBy: { createdAt: "desc" },
    });
  }
  if (!lead) {
    logger.info("ONBOARDING_WEBHOOK", "No matching lead", { event, token, contactEmail });
    return NextResponse.json({ ok: true, matched: false });
  }

  // The portal was deleted in the onboarding tool: drop its tracking here so
  // the lead page stops showing the panel, and leave one line on the timeline.
  if (event === "onboarding_deleted") {
    const tokenFilter = token ? { eventDataJson: { path: ["token"], equals: token } } : {};
    const removed = await prisma.leadEvent.deleteMany({
      where: { leadId: lead.id, eventType: { in: ["onboarding_profile_created", "onboarding_milestone"] }, ...tokenFilter },
    });
    await prisma.leadEvent.create({
      data: {
        leadId: lead.id,
        eventType: "onboarding_portal_deleted",
        eventDataJson: { token, removedEvents: removed.count, at: typeof body.at === "string" ? body.at : new Date().toISOString() },
      },
    });
    await prisma.lead.update({ where: { id: lead.id }, data: { lastActivityAt: new Date() } });
    logger.info("ONBOARDING_WEBHOOK", "Portal deleted; tracking removed", { leadId: lead.id, removed: removed.count });
    return NextResponse.json({ ok: true, matched: true, removed: removed.count });
  }

  const label = MILESTONE_LABELS[event] ?? event.replace(/_/g, " ");
  await prisma.leadEvent.create({
    data: {
      leadId: lead.id,
      eventType: "onboarding_milestone",
      eventDataJson: {
        milestone: event,
        label,
        token,
        portalUrl: typeof body.portal_url === "string" ? body.portal_url : null,
        detail: typeof body.detail === "string" ? body.detail : null,
        at: typeof body.at === "string" ? body.at : new Date().toISOString(),
      },
    },
  });

  const updates: Record<string, unknown> = { lastActivityAt: new Date() };
  const terminal = ["WON", "LOST", "DISQUALIFIED", "ARCHIVED", "MERGED", "DUPLICATE"];
  if (event === "onboarding_complete" && !terminal.includes(lead.status)) {
    updates.status = "WON";
    await prisma.leadEvent.create({
      data: { leadId: lead.id, eventType: "status_changed", eventDataJson: { from: lead.status, to: "WON", reason: "onboarding_complete" } },
    });
  }
  await prisma.lead.update({ where: { id: lead.id }, data: updates as never });

  const notable = ["agreement_signed", "onboarding_complete", "portal_opened"];
  if (notable.includes(event)) {
    const who = lead.companyName || lead.fullName || "A client";
    const title = `${who}: ${label.toLowerCase()}`;
    const priority = event === "portal_opened" ? "NORMAL" : "HIGH";
    if (lead.assignedUserId) {
      await createNotification(lead.assignedUserId, "lead_updated", title, "Onboarding progress", lead.id, priority).catch(() => {});
    } else {
      await createNotificationsForRole("ADMIN", "lead_updated", title, "Onboarding progress", lead.id, priority).catch(() => {});
    }
  }

  logger.info("ONBOARDING_WEBHOOK", "Milestone recorded", { leadId: lead.id, event });
  return NextResponse.json({ ok: true, matched: true });
}
