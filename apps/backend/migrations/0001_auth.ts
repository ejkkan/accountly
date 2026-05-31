import { Kysely, sql } from "kysely";

/**
 * better-auth 1.6 schema — core (user/session/account/verification) plus the
 * organization plugin's three tables. Column casing is camelCase because
 * better-auth uses camelCase by default; Kysely quotes identifiers so this
 * works on Postgres unchanged. IDs are TEXT (better-auth issues cuid-shaped
 * strings, not UUIDs).
 *
 * Translated by hand from better-auth's documented schema rather than via
 * `@better-auth/cli generate` so the migration is self-contained and doesn't
 * require a separate static auth-config file the CLI can introspect.
 */

// Migrations run against a database whose shape only takes form after this
// runs — Kysely's migrator types the argument as `unknown` for exactly this
// reason. Casting it down once at the top keeps the schema-builder fluent.
type AnyKysely = Kysely<Record<string, unknown>>;

export async function up(rawDb: Kysely<unknown>): Promise<void> {
  const db = rawDb as AnyKysely;

  await db.schema
    .createTable("user")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("email", "text", (c) => c.notNull().unique())
    .addColumn("emailVerified", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("image", "text")
    .addColumn("createdAt", sql`timestamptz`, (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updatedAt", sql`timestamptz`, (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("session")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("userId", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .addColumn("token", "text", (c) => c.notNull().unique())
    .addColumn("expiresAt", sql`timestamptz`, (c) => c.notNull())
    .addColumn("ipAddress", "text")
    .addColumn("userAgent", "text")
    // Added by the organization plugin so we don't need a separate migration.
    .addColumn("activeOrganizationId", "text")
    .addColumn("createdAt", sql`timestamptz`, (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updatedAt", sql`timestamptz`, (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex("session_userId_idx").on("session").column("userId").execute();

  await db.schema
    .createTable("account")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("userId", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .addColumn("accountId", "text", (c) => c.notNull())
    .addColumn("providerId", "text", (c) => c.notNull())
    .addColumn("accessToken", "text")
    .addColumn("refreshToken", "text")
    .addColumn("idToken", "text")
    .addColumn("accessTokenExpiresAt", sql`timestamptz`)
    .addColumn("refreshTokenExpiresAt", sql`timestamptz`)
    .addColumn("scope", "text")
    .addColumn("password", "text")
    .addColumn("createdAt", sql`timestamptz`, (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updatedAt", sql`timestamptz`, (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex("account_userId_idx").on("account").column("userId").execute();

  await db.schema
    .createTable("verification")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("identifier", "text", (c) => c.notNull())
    .addColumn("value", "text", (c) => c.notNull())
    .addColumn("expiresAt", sql`timestamptz`, (c) => c.notNull())
    .addColumn("createdAt", sql`timestamptz`, (c) => c.defaultTo(sql`now()`))
    .addColumn("updatedAt", sql`timestamptz`, (c) => c.defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("verification_identifier_idx")
    .on("verification")
    .column("identifier")
    .execute();

  // ---- organization plugin ----

  await db.schema
    .createTable("organization")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("slug", "text", (c) => c.notNull().unique())
    .addColumn("logo", "text")
    // better-auth stores metadata as JSON-encoded text; jsonb would also work
    // but text matches what the lib writes by default.
    .addColumn("metadata", "text")
    .addColumn("createdAt", sql`timestamptz`, (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("member")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) =>
      c.notNull().references("organization.id").onDelete("cascade")
    )
    .addColumn("userId", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .addColumn("role", "text", (c) => c.notNull().defaultTo("member"))
    .addColumn("createdAt", sql`timestamptz`, (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("member_organizationId_idx")
    .on("member")
    .column("organizationId")
    .execute();

  await db.schema.createIndex("member_userId_idx").on("member").column("userId").execute();

  await db.schema
    .createTable("invitation")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) =>
      c.notNull().references("organization.id").onDelete("cascade")
    )
    .addColumn("email", "text", (c) => c.notNull())
    .addColumn("role", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull().defaultTo("pending"))
    .addColumn("expiresAt", sql`timestamptz`, (c) => c.notNull())
    .addColumn("inviterId", "text", (c) => c.notNull().references("user.id").onDelete("cascade"))
    .execute();
}

export async function down(rawDb: Kysely<unknown>): Promise<void> {
  const db = rawDb as AnyKysely;
  await db.schema.dropTable("invitation").ifExists().execute();
  await db.schema.dropTable("member").ifExists().execute();
  await db.schema.dropTable("organization").ifExists().execute();
  await db.schema.dropTable("verification").ifExists().execute();
  await db.schema.dropTable("account").ifExists().execute();
  await db.schema.dropTable("session").ifExists().execute();
  await db.schema.dropTable("user").ifExists().execute();
}
