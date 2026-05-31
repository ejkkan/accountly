import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge-side session gate. Runs before any rendering, so we can redirect with
 * a real 307 (server layouts in Next 16 + Turbopack start streaming before
 * the layout's async work resolves, which means a layout-level redirect
 * leaks "NEXT_REDIRECT" into the body instead of a clean header response).
 *
 * Just forwards the incoming `cookie` to the Worker's /api/auth/get-session
 * and bounces to /auth/sign-in if the body is null. better-auth sets the
 * session cookie on the same origin (Next rewrites /api/* to the Worker)
 * so cookie forwarding "just works."
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8787";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const cookie = request.headers.get("cookie") ?? "";

  const res = await fetch(`${BACKEND_URL}/api/auth/get-session`, {
    headers: { cookie },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  // better-auth's get-session returns the raw text "null" (not a JSON null)
  // when there's no session. Check the text shape directly — `await res.json()`
  // on "null" was returning the literal string in this Next + undici combo,
  // so the simpler text comparison is more reliable.
  const text = await res.text();
  if (text === "" || text === "null") {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Every route inside the (app) group is mounted at the top level (route
  // groups don't appear in URLs), so match the bare paths here.
  matcher: ["/bills/:path*"],
};
