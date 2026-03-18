import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ALLOWED_ORIGINS = [
  "https://noahalbers.github.io",
  "https://www.advancedcb.com",
  "https://advancedcb.com",
  "http://localhost:3000",
];

function corsHeaders(origin: string | null) {
  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));

  try {
    const dbCheck = Promise.race([
      prisma.$queryRaw`SELECT 1`.then(() => "connected" as const),
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), 3000)
      ),
    ]);

    const [dbStatus, queueDepth, lastLead] = await Promise.all([
      dbCheck,
      prisma.ingestionQueue
        .count({ where: { status: { in: ["received", "processing"] } } })
        .catch(() => -1),
      prisma.lead
        .findFirst({
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
        .catch(() => null),
    ]);

    return NextResponse.json(
      {
        status: dbStatus === "connected" ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        database: dbStatus === "connected" ? "connected" : "disconnected",
        queue_depth: queueDepth,
        last_lead_received_at: lastLead?.createdAt?.toISOString() ?? null,
      },
      { headers }
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      },
      { headers }
    );
  }
}
