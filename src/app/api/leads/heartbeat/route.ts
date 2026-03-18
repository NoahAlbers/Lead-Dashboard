import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-ACB-Form-Key",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    // Rate limiting (2 per minute — use IP-based)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { ok: true },
        {
          status: 200,
          headers: {
            ...headers,
            "Retry-After": String(rateCheck.retryAfter ?? 60),
          },
        }
      );
    }

    const body = await req.json();
    const sessionId = body.session_id;

    if (!sessionId) {
      return NextResponse.json({ ok: true }, { status: 200, headers });
    }

    // Find matching active partial session and update heartbeat
    const existing = await prisma.ingestionQueue.findFirst({
      where: { sessionId, isPartial: true, status: "partial" },
    });

    if (existing) {
      await prisma.ingestionQueue.update({
        where: { id: existing.id },
        data: { lastHeartbeatAt: new Date() },
      });
    }

    // Always return ok (don't leak info about whether session exists)
    return NextResponse.json({ ok: true }, { status: 200, headers });
  } catch (error: unknown) {
    console.error("Heartbeat error:", error);
    return NextResponse.json({ ok: true }, { status: 200, headers });
  }
}
