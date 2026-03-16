"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import Papa from "papaparse";
import { format, toZonedTime } from "date-fns-tz";

const EST_TZ = "America/New_York";

export async function exportActivityLog(params: {
  dateFrom: string; // ISO date string (YYYY-MM-DD)
  dateTo: string; // ISO date string (YYYY-MM-DD)
  eventTypes?: string[];
  scope: "all" | "my_leads" | "user";
  userId?: string; // for scope=user
}): Promise<string> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  // ADMIN/MANAGER can see all; others only their assigned leads
  const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);

  const where: Record<string, unknown> = {
    createdAt: {
      gte: new Date(params.dateFrom),
      lte: new Date(params.dateTo + "T23:59:59.999Z"),
    },
  };

  if (params.eventTypes && params.eventTypes.length > 0) {
    where.eventType = { in: params.eventTypes };
  }

  if (params.scope === "my_leads" || (!isAdmin && params.scope === "all")) {
    where.lead = { assignedUserId: session.user.id };
  } else if (params.scope === "user" && params.userId) {
    where.lead = { assignedUserId: params.userId };
  }

  const events = await prisma.leadEvent.findMany({
    where,
    include: {
      lead: {
        select: {
          companyName: true,
          fullName: true,
          status: true,
          score: true,
        },
      },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  const rows = events.map((e) => ({
    "Timestamp (EST)": format(
      toZonedTime(e.createdAt, EST_TZ),
      "MM/dd/yyyy hh:mm a",
      { timeZone: EST_TZ },
    ),
    "Lead ID": e.leadId,
    Company: e.lead?.companyName ?? "",
    Contact: e.lead?.fullName ?? "",
    "Event Type": e.eventType.replace(/_/g, " "),
    "Performed By": e.user?.name ?? "System",
    "Lead Status": e.lead?.status ?? "",
    "Lead Score": e.lead?.score ?? "",
    Details: JSON.stringify(e.eventDataJson ?? {}),
  }));

  return Papa.unparse(rows);
}
