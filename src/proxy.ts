import { NextRequest, NextResponse } from "next/server";

// Gate the admin page AND its API routes behind one password (HTTP Basic Auth).
// The public gallery never hits these paths, so visitors are unaffected.
// (Next.js 16 renamed the "middleware" convention to "proxy".)
export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/artworks", "/api/artworks/:path*"],
};

export function proxy(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  const user = process.env.ADMIN_USER || "admin";

  // No password configured:
  //  - in production (Vercel) block admin entirely — fail closed, safe by default
  //  - in local dev leave it open for convenience
  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "Admin is disabled. Set ADMIN_PASSWORD to enable it.",
        { status: 503 }
      );
    }
    return NextResponse.next();
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(":");
      const u = decoded.slice(0, sep);
      const p = decoded.slice(sep + 1);
      if (u === user && p === password) return NextResponse.next();
    } catch {
      // malformed header — fall through to challenge
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Gallery Admin"' },
  });
}
