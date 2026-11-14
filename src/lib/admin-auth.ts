import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

// Defence in depth for the snail-mail admin API.
//
// src/proxy.ts already puts HTTP Basic Auth in front of /admin and /api/admin.
// These routes handle subscribers' home addresses, so each handler ALSO checks
// the same credentials itself: if the proxy matcher is ever changed or
// refactored, the data stays protected. Same rules as the proxy:
//   - ADMIN_PASSWORD set     -> require matching Basic credentials
//   - not set, production    -> refuse everything (fail closed)
//   - not set, local dev     -> open, for convenience

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Returns null when the request is allowed, otherwise the response to send. */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const password = process.env.ADMIN_PASSWORD;
  const user = process.env.ADMIN_USER || "admin";

  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Admin is disabled. Set ADMIN_PASSWORD to enable it." },
        { status: 503 }
      );
    }
    return null;
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(":");
      if (sep >= 0) {
        const u = decoded.slice(0, sep);
        const p = decoded.slice(sep + 1);
        if (safeEqual(u, user) && safeEqual(p, password)) return null;
      }
    } catch {
      // malformed header — fall through to the challenge
    }
  }

  return NextResponse.json(
    { error: "Authentication required." },
    { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Gallery Admin"' } }
  );
}
