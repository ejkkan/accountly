import { Hono } from "hono";

export interface Env {
  // Filled in as later phases add bindings:
  //   DATABASE_URL, BETTER_AUTH_SECRET, ANTHROPIC_API_KEY, INVOICES (R2), ...
}

/**
 * The Hono `app` is kept as one chained expression so `typeof app` carries
 * the full route tree. Sub-routes attached via `.route(...)` must also be
 * built as chained `.get()/.post()` expressions for their internal types
 * to survive into the client.
 */
const app = new Hono<{ Bindings: Env }>()
  .get("/api/health", (c) => c.json({ ok: true as const, service: "accountly-backend" }));

export type AppType = typeof app;

export default {
  fetch: app.fetch,
};
