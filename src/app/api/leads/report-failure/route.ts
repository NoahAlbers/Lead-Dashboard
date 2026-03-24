import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendFailureAlertEmail } from "@/services/email-notification.service";
import { logger } from "@/lib/logger";

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

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const body = await req.json();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    const submissionId = body.submission_id ?? `failure-${Date.now()}`;

    logger.error("REPORT-FAILURE", "Client reported total failure", {
      submissionId,
      sessionId: body.session_id,
      ip,
      errors: body.errors,
    });

    // Save to IngestionQueue with special status
    await prisma.ingestionQueue.create({
      data: {
        submissionId,
        sessionId: body.session_id ?? null,
        status: "client_failure",
        isPartial: false,
        rawPayload: body,
        sourceIp: ip,
        formVersion: body.form_version ?? null,
        errorMessage: (
          body.error_message ??
          (Array.isArray(body.errors)
            ? body.errors.map((e: { error?: string }) => e.error).join("; ")
            : "Client reported total failure")
        ).slice(0, 2000),
      },
    });

    // Send alert email
    sendFailureAlertEmail({
      type: "client_total_failure",
      message:
        body.error_message ?? "All submission attempts failed on client side",
      submissionId,
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json(
      { success: true, message: "Failure recorded" },
      { status: 200, headers }
    );
  } catch (error) {
    logger.error("REPORT-FAILURE", "Error recording failure", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false },
      { status: 500, headers }
    );
  }
}
