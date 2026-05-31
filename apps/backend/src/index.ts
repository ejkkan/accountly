import { Hono } from "hono";
import { createAuth } from "./auth";
import { createDb } from "./db";
import { billsRoutes } from "./routes/bills";
import { suppliersRoutes } from "./routes/suppliers";
import { AppError } from "./lib/errors";
import { log } from "./lib/log";

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
  .route("/api/bills", billsRoutes)
  .route("/api/suppliers", suppliersRoutes)

  // Single source of truth for the error wire-format. `AppError` carries
  // status/code/message itself; anything else becomes `internal` 500.
  // Crucially: this DOESN'T add to the route's response type — handlers
  // declare success shapes via `c.json(...)` and errors leave via throw,
  // so `hc<AppType>` keeps inferring success types cleanly.
  .onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        { error: { code: err.code, message: err.message, fields: err.fields } },
        err.status
      );
    }
    log("error.unhandled", {
      path: c.req.path,
      method: c.req.method,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return c.json(
      { error: { code: "internal", message: "Something went wrong on our end." } },
      500
    );
  });

export type AppType = typeof app;

export default {
  fetch: app.fetch,
};
