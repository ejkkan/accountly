import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

/**
 * better-auth's client validates baseURL with `new URL()` — a bare
 * `/api/auth` rejects. On the browser the origin is whatever the page is
 * served from; on the server (RSC render of the auth pages) we fall back to
 * NEXT_PUBLIC_APP_URL, then localhost so dev never blows up.
 *
 * basePath defaults to /api/auth, which matches the catch-all .all("/api/auth/*")
 * route mounted on the Worker.
 */
const baseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5001";

export const authClient = createAuthClient({
  baseURL,
  plugins: [organizationClient()],
});
