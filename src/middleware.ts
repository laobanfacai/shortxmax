import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifySession } from "@/lib/session-token";

const ADMIN_PREFIXES = ["/admin", "/api/admin"];
const AUTH_REQUIRED = ["/account", "/checkout"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !pathname.startsWith("/api/webhooks/")) {
    const origin = req.headers.get("origin");
    const fetchSite = req.headers.get("sec-fetch-site");
    let valid = false;
    try { valid = Boolean(origin) && new URL(origin!).host === req.headers.get("host"); } catch {}
    if (fetchSite === "cross-site" || !valid) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const isAdminPath = ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const needsAuth = AUTH_REQUIRED.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isAdminPath) {
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (session.role !== "admin" || session.status === "banned") {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  if (needsAuth && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/checkout/:path*", "/api/:path*"],
};
