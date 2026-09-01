import { attachServerGeo } from "@/lib/request-geo";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateReceiptId } from "@/services/receipt.service";
import { checkRateLimit } from "@/lib/rate-limit";
import { processIngestionItem } from "@/services/ingestion-pipeline.service";
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

    // Parse body FIRST (before auth) so we never lose data
    const body = await req.json();
    attachServerGeo(body, req.headers);
    const submissionId = body.submission_id;
    if (!submissionId) {
      return NextResponse.json(
        {
          success: false,
          error: "validation_error",
          message: "Missing submission_id",
        },
        { status: 400, headers }
      );
    }

    // Auth — validate form key (but NEVER reject — save regardless)
    const formKey = req.headers.get("x-acb-form-key");
    const configRow = await prisma.systemConfig.findUnique({
      where: { key: "ingestion_form_key" },
    });
    const expectedKey = configRow?.value ?? null;
    const authValid = !!(formKey && formKey === expectedKey);

    if (!authValid) {
      logger.warn("INGEST", "Auth check failed — saving submission anyway", {
        submissionId,
        formKeyPresent: !!formKey,
        configKeyPresent: !!expectedKey,
        ip,
      });
    }

    // Check for duplicate
    const existing = await prisma.ingestionQueue.findUnique({
      where: { submissionId },
    });
    if (existing) {
      return NextResponse.json(
        {
          success: true,
          receipt_id: existing.receiptId,
          lead_id: existing.leadId,
          submission_id: submissionId,
          status: "already_received",
          message: "This submission was already processed",
        },
        { status: 200, headers }
      );
    }

    // Generate receipt
    const receiptId = await generateReceiptId();

    // Write-ahead: save to queue FIRST
    const queueItem = await prisma.ingestionQueue.create({
      data: {
        submissionId,
        sessionId: body.session_id ?? body.metadata?.session_id ?? null,
        status: authValid ? "received" : "auth_suspect",
        isPartial: false,
        rawPayload: body,
        receiptId,
        formVersion: body.form_version ?? null,
        sourceIp: ip,
      },
    });

    logger.info("INGEST", "Submission saved to queue", {
      submissionId,
      receiptId,
      authValid,
      status: authValid ? "received" : "auth_suspect",
    });

    // Process synchronously so the lead exists in the DB before we respond.
    // This adds ~300ms but prevents 404s when the user clicks the new lead.
    if (authValid) {
      try {
        await processIngestionItem(queueItem.id);

        // Re-fetch to get the lead_id after processing
        const processed = await prisma.ingestionQueue.findUnique({
          where: { id: queueItem.id },
        });

        return NextResponse.json(
          {
            success: true,
            receipt_id: receiptId,
            lead_id: processed?.leadId ?? null,
            submission_id: submissionId,
            received_at: new Date().toISOString(),
            status:
              processed?.status === "completed" ? "completed" : "received",
          },
          { status: 200, headers }
        );
      } catch (processingError) {
        logger.error("INGEST", "Processing failed (data is queued)", {
          queueId: queueItem.id,
          error:
            processingError instanceof Error
              ? processingError.message
              : String(processingError),
        });
        // Data IS saved in the queue — respond with success
        return NextResponse.json(
          {
            success: true,
            receipt_id: receiptId,
            lead_id: null,
            submission_id: submissionId,
            received_at: new Date().toISOString(),
            status: "received",
            message:
              "Submission received. Processing will complete shortly.",
          },
          { status: 200, headers }
        );
      }
    }

    // Auth-suspect: saved but not processed — return 200
    return NextResponse.json(
      {
        success: true,
        receipt_id: receiptId,
        lead_id: null,
        submission_id: submissionId,
        received_at: new Date().toISOString(),
        status: "received",
      },
      { status: 200, headers }
    );
  } catch (error: unknown) {
    logger.error("INGEST", "Ingestion error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        error: "server_error",
        message: "Internal error — submission may not have been saved",
      },
      { status: 500, headers }
    );
  }
}
