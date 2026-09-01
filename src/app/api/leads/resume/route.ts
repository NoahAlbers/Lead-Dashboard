import { NextRequest, NextResponse } from "next/server";
import { resolveResumeToken } from "@/services/recapture.service";
import { checkRateLimit } from "@/lib/rate-limit";

// Restore API for recapture resume links. The intake form calls this with the
// token from ?resume= and gets back the saved fields + last step so it can
// prefill and continue the original session. Returns only what the visitor
// themselves typed; no internal data.

const ALLOWED_ORIGINS = [
  "https://noahalbers.github.io",
  "https://www.advancedcb.com",
  "https://advancedcb.com",
  "http://localhost:3000",
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return NextResponse.json({ success: false, error: "rate_limited" }, { status: 429, headers });
  }

  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ success: false, error: "missing_token" }, { status: 400, headers });
  }

  const result = await resolveResumeToken(token);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.error === "expired" ? 410 : 404, headers }
    );
  }

  return NextResponse.json(
    {
      success: true,
      session_id: result.sessionId,
      fields: result.fields,
      step: result.step,
    },
    { status: 200, headers }
  );
}
