import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import type { Kysely } from "kysely";
import type { Database } from "./db";

export interface AuthEnv {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  /** Front-end origin used to build trusted-origin CORS for cookie auth. */
  APP_URL: string;
}

/**
 * Subset of better-auth's `Auth` shape we actually call from route handlers.
 * The full inferred type pulls in plugin-augmented user/session models that
 * fight Kysely's strict types; this structural cast at the boundary keeps
 * the rest of the codebase clean.
 */
export interface AuthInstance {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (input: { headers: Headers }) => Promise<{
      user: { id: string };
      session: { activeOrganizationId?: string | null };
    } | null>;
  };
}

export function createAuth(db: Kysely<Database>, env: AuthEnv): AuthInstance {
  return betterAuthInstance(db, env) as unknown as AuthInstance;
}

function slugFromEmail(email: string): string {
  const local = email.split("@")[0]?.toLowerCase() ?? "user";
  return (
    local
      .replace(/\+.*$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "user"
  );
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

function betterAuthInstance(db: Kysely<Database>, env: AuthEnv) {
  return betterAuth({
    database: { db: db as unknown as Kysely<unknown>, type: "postgres" },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    emailAndPassword: { enabled: true },
    trustedOrigins: [env.APP_URL, "http://localhost:5001"],

    plugins: [
      organization({
        allowUserToCreateOrganization: true,
        requireEmailVerificationOnInvitation: false,
      }),
    ],

    databaseHooks: {
      user: {
        create: {
          // Give every new user a personal org so the product has a scope to
          // hang bills off. Slug derives from the email local-part with a
          // random suffix on collision.
          after: async (user) => {
            const id = crypto.randomUUID();
            const now = new Date();
            const base = slugFromEmail(user.email);

            let slug = base;
            for (let attempt = 0; attempt < 5; attempt++) {
              try {
                await (db as unknown as Kysely<Record<string, unknown>>)
                  .insertInto("organization")
                  .values({
                    id,
                    name: `${user.name || user.email.split("@")[0]}'s Workspace`,
                    slug,
                    logo: null,
                    metadata: null,
                    createdAt: now,
                  })
                  .execute();
                break;
              } catch (err) {
                slug = `${base}-${randomSuffix()}`;
                if (attempt === 4) throw err;
              }
            }

            await (db as unknown as Kysely<Record<string, unknown>>)
              .insertInto("member")
              .values({
                id: crypto.randomUUID(),
                organizationId: id,
                userId: user.id,
                role: "owner",
                createdAt: now,
              })
              .execute();
          },
        },
      },
    },
  });
}
