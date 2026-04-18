import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { SESSION_OPTIONS, type SessionData } from "@/lib/session-config";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, SESSION_OPTIONS);

  // Not logged in — redirect to login
  if (!session.userId) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (session.role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Per-tab permission gates (admin bypasses all)
  if (session.role !== "admin") {
    const tabGates: Array<{ prefix: string; allowed: boolean | undefined }> = [
      { prefix: "/compliance",    allowed: session.canCompliance },
      { prefix: "/api/my/compliance", allowed: session.canCompliance },
      { prefix: "/contracts",     allowed: session.canContracts },
      { prefix: "/api/my/contracts",  allowed: session.canContracts },
      { prefix: "/assets",        allowed: session.canAssets },
      { prefix: "/api/my/assets",     allowed: session.canAssets },
      { prefix: "/network",       allowed: session.canNetwork },
      { prefix: "/api/my/network",    allowed: session.canNetwork },
      { prefix: "/loans",         allowed: session.canLoans },
      { prefix: "/api/my/loans",      allowed: session.canLoans },
      { prefix: "/api/my/loan-pool",  allowed: session.canLoans },
      { prefix: "/directory",     allowed: session.canDirectory },
      { prefix: "/api/my/directory",  allowed: session.canDirectory },
    ];
    for (const { prefix, allowed } of tabGates) {
      if (pathname.startsWith(prefix) && allowed === false) {
        // For API calls return 403; for pages redirect to dashboard
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
