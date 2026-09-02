import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken, suppressEmail } from "@/lib/acb-email";
import { logger } from "@/lib/logger";

// One-click unsubscribe target. Linked from the footer of every lead-facing
// automated email and from the List-Unsubscribe header. Token is an HMAC of
// the address, so the link works without any stored state.

function page(title: string, message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#F4F5F9;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:480px;margin:80px auto;background:#fff;border:1px solid #E2E4EC;border-radius:14px;padding:40px;text-align:center;color:#1A1A2E;">
<div style="display:inline-block;background:#3D5AF1;color:#fff;font-weight:bold;font-size:14px;border-radius:8px;padding:6px 9px;margin-bottom:16px;">ACB</div>
<h1 style="font-size:20px;margin:0 0 10px;">${title}</h1>
<p style="color:#4A4A68;font-size:15px;line-height:1.6;margin:0;">${message}</p>
</div></body></html>`;
}

export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
  const token = req.nextUrl.searchParams.get("token") ?? "";

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return new NextResponse(
      page("Link not valid", "This unsubscribe link is missing or expired. If you want to stop receiving emails, reply to any of our messages and we will take care of it."),
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  await suppressEmail(email, "unsubscribed", "unsubscribe_link");
  logger.info("EMAIL", "Address unsubscribed", { email });

  return new NextResponse(
    page("You're unsubscribed", "We will not send any more automated emails to this address. If this was a mistake, just reply to one of our earlier messages."),
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

// RFC 8058 one-click unsubscribe (mail clients POST to the same URL).
export async function POST(req: NextRequest) {
  return GET(req);
}
