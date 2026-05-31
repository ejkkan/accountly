import { hc } from "hono/client";
import type { AppType } from "@accountly/backend";

/**
 * The single typed RPC client. `AppType = typeof app` carries the backend's
 * full route tree, so `api.api.bills.$get()` and friends autocomplete and
 * refuse wrong params at compile time. Hooks in src/hooks/ consume this — UI
 * components never call `fetch` directly.
 *
 * Browser → same-origin `/api/*` → Next rewrites to the Worker (see
 * next.config.ts). Means cookies + bearer keys round-trip without any CORS
 * configuration.
 */
export const api = hc<AppType>("/", {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, { ...init, credentials: "include" }),
});
