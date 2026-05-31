import { Hono } from "hono";
import { createAuth } from "./auth";
import { createDb } from "./db";
import { billsRoutes } from "./routes/bills";

export interface Env {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  /** Front-end origin — also baked into better-auth's trustedOrigins. */
  APP_URL: string;
  /** Anthropic key for invoice → journal-entry generation (used in phase 5). */
  ANTHROPIC_API_KEY: string;
  /** R2 bucket holding uploaded PDFs. See wrangler.jsonc. */
  INVOICES: R2Bucket;
}

/**
 * Single chained Hono expression: every `.route()` / `.get()` / `.post()`
 * stays attached so `typeof app` carries the full route tree into the web
 * app's `hc<AppType>` client. Don't split this into intermediate variables.
 */
const app = new Hono<{ Bindings: Env }>()
  .get("/api/health", (c) => c.json({ ok: true as const, service: "accountly-backend" }))
  // better-auth owns every /api/auth/* path. Each request gets its own
  // Kysely instance because pg holds no useful per-Worker state, and the
  // pool only ever opens one connection (Neon's pooler does the multiplex).
  .all("/api/auth/*", (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const auth = createAuth(db, {
      BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: c.env.BETTER_AUTH_URL,
      APP_URL: c.env.APP_URL,
    });
    return auth.handler(c.req.raw);
  })
  .route("/api/bills", billsRoutes);

export type AppType = typeof app;

export default {
  fetch: app.fetch,
};
