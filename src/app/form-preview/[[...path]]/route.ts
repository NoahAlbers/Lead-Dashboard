import { NextRequest, NextResponse } from "next/server";

// Proxies the public intake form's files from GitHub so admins can preview
// experiment variants inside the dashboard. Sits behind the auth middleware on
// purpose: the folder and index.html require a login, and the form's own
// preview mode (?ab=<variant>) keeps it from writing any leads or events.

export const dynamic = "force-dynamic";

const REPO = "noahalbers/acb-form";

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  json: "application/json; charset=utf-8",
  woff2: "font/woff2",
};

function previewBranch(): string {
  return process.env.FORM_PREVIEW_BRANCH || (process.env.VERCEL_ENV === "production" ? "main" : "dev");
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path: segments } = await ctx.params;
  const path = segments && segments.length ? segments.join("/") : "index.html";
  if (path.includes("..") || path.startsWith("/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const upstream = await fetch(`https://raw.githubusercontent.com/${REPO}/${previewBranch()}/${path}`, { cache: "no-store" });
  if (!upstream.ok) return new NextResponse("Not found", { status: 404 });

  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  const headers = { "Content-Type": contentType, "Cache-Control": "private, max-age=60" };

  if (ext === "html") {
    let html = await upstream.text();
    // No analytics from inside the preview frame.
    html = html.replace(/<script[^>]*>[^<]*clarity\.ms[^<]*<\/script>/gi, "");
    // Relative assets resolve against the proxy folder even when the URL has no trailing slash.
    html = html.replace(/<head([^>]*)>/i, '<head$1><base href="/form-preview/">');
    return new NextResponse(html, { headers });
  }

  return new NextResponse(await upstream.arrayBuffer(), { headers });
}
