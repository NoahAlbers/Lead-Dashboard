import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import crypto from "crypto";

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
    // Rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "rate_limited",
          message: "Too many requests",
        },
        {
          status: 429,
          headers: {
            ...headers,
            "Retry-After": String(rateCheck.retryAfter ?? 60),
          },
        }
      );
    }

    // Parse body FIRST (before auth) so we never lose partial data
    const body = await req.json();
    const sessionId = body.session_id;
    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: "validation_error",
          message: "Missing session_id",
        },
        { status: 400, headers }
      );
    }

    // Auth — validate form key (but never reject — save regardless)
    const formKey = req.headers.get("x-acb-form-key");
    const configRow = await prisma.systemConfig.findUnique({
      where: { key: "ingestion_form_key" },
    });
    const expectedKey = configRow?.value ?? null;
    const authValid = !!(formKey && formKey === expectedKey);

    if (!authValid) {
      logger.warn("PARTIAL", "Auth check failed — saving partial anyway", {
        sessionId,
        formKeyPresent: !!formKey,
        ip,
      });
    }

    const submissionId =
      body.submission_id ?? `partial-${crypto.randomUUID()}`;
    const partialStep = body.partial_step ?? body.step ?? null;

    // Look for existing partial with matching sessionId
    const existing = await prisma.ingestionQueue.findFirst({
      where: { sessionId, isPartial: true, status: "partial" },
    });

    if (existing) {
      // Deep merge fields into existing rawPayload
      const existingPayload =
        (existing.rawPayload as Record<string, unknown>) ?? {};
      const existingFields =
        (existingPayload.fields as Record<string, unknown>) ?? {};
      const newFields =
        (body.fields as Record<string, unknown>) ?? {};
      const mergedPayload = {
        ...existingPayload,
        ...body,
        fields: { ...existingFields, ...newFields },
      };

      await prisma.ingestionQueue.update({
        where: { id: existing.id },
        data: {
          rawPayload: mergedPayload,
          partialStep,
        },
      });
    } else {
      // Create new partial entry
      await prisma.ingestionQueue.create({
        data: {
          submissionId,
          sessionId,
          status: "partial",
          isPartial: true,
          partialStep,
          rawPayload: body,
          sourceIp: ip,
          formVersion: body.form_version ?? null,
        },
      });
    }

    return NextResponse.json({ success: true }, { status: 200, headers });
  } catch (error: unknown) {
    logger.error("PARTIAL", "Partial ingestion error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        error: "server_error",
        message: "Internal error",
      },
      { status: 500, headers }
    );
  }
}
