import { NextRequest, NextResponse } from "next/server";

// Origins the public intake form may call from (GitHub Pages embed, the
// marketing site, and the Webflow Cloud copy).
export const FORM_ORIGINS = [
  "https://noahalbers.github.io",
  "https://www.advancedcb.com",
  "https://advancedcb.com",
  "https://www.advancedcb.app",
];

export function formCorsHeaders(origin: string | null, methods = "POST, OPTIONS") {
  const allowed = origin && (FORM_ORIGINS.includes(origin) || origin.endsWith(".webflow.io")) ? origin : FORM_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, X-ACB-Form-Key",
    "Access-Control-Max-Age": "86400",
  };
}

export function formPreflight(req: NextRequest, methods?: string) {
  return new NextResponse(null, { status: 204, headers: formCorsHeaders(req.headers.get("origin"), methods) });
}
