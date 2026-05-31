import type { MiddlewareHandler } from "hono";
import { createAuth } from "../auth";
import { createDb, type Database } from "../db";
import type { Env } from "../index";
import type { Kysely } from "kysely";
import { log } from "../lib/log";
import { Forbidden, Unauthorized } from "../lib/errors";

/**
 * Context augmentation added by `requireSession`. Routes that mount the
 * middleware can pull `c.get("userId")` etc. without re-parsing the cookie.
 */
export type AuthVariables = {
  userId: string;
  organizationId: string;
  db: Kysely<Database>;
};

/**
 * Look up the session via better-auth and attach userId + the user's active
 * organization to the context. Throws AppError for the failure cases — the
 * root `.onError` handler turns it into the standard error body.
 *
 * Active organization defaults to the user's first membership when
 * better-auth hasn't populated session.activeOrganizationId yet (fresh
 * signup, no organization-switcher click).
 */
export const requireSession = (): MiddlewareHandler<{
  Bindings: Env;
  Variables: AuthVariables;
}> => {
  return async (c, next) => {
    const db = createDb(c.env.DATABASE_URL);
    const auth = createAuth(db, {
      BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: c.env.BETTER_AUTH_URL,
      APP_URL: c.env.APP_URL,
    });

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      log("auth.rejected", { reason: "no_session", path: c.req.path });
      throw Unauthorized();
    }

    let organizationId = session.session.activeOrganizationId ?? null;
    if (!organizationId) {
      // Fall back to the user's first membership — every signup auto-creates
      // a personal org via auth.ts's user.create.after hook, so this should
      // always resolve.
      const member = await db
        .selectFrom("member")
        .select("organizationId")
        .where("userId", "=", session.user.id)
        .orderBy("createdAt", "asc")
        .limit(1)
        .executeTakeFirst();
      organizationId = member?.organizationId ?? null;
    }

    if (!organizationId) {
      log("auth.rejected", {
        reason: "no_org",
        userId: session.user.id,
        path: c.req.path,
      });
      throw Forbidden("no_org", "Your account isn't attached to a workspace.");
    }

    c.set("userId", session.user.id);
    c.set("organizationId", organizationId);
    c.set("db", db);

    await next();
  };
};
