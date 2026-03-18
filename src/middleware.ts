import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow webhook endpoints without auth
  if (pathname.startsWith("/api/webhooks")) {
    return NextResponse.next();
  }

  // Allow public API endpoints (lead ingestion + health)
  if (
    pathname.startsWith("/api/leads/ingest") ||
    pathname.startsWith("/api/leads/partial") ||
    pathname.startsWith("/api/leads/heartbeat") ||
    pathname.startsWith("/api/health")
  ) {
    return NextResponse.next();
  }

  // Allow auth API routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow login page
  if (pathname === "/login") {
    if (req.auth) {
      return NextResponse.redirect(new URL("/leads", req.url));
    }
    return NextResponse.next();
  }

  // Require auth for everything else
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Admin-only routes (allow MANAGER for monitor page)
  if (pathname.startsWith("/admin")) {
    const role = req.auth.user?.role;
    if (pathname.startsWith("/admin/monitor")) {
      if (role !== "ADMIN" && role !== "MANAGER") {
        return NextResponse.redirect(new URL("/leads", req.url));
      }
    } else if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/leads", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
