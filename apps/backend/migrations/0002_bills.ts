import { Kysely, sql } from "kysely";

/**
 * App schema for the invoice → journal entry flow.
 *
 * Money is stored as integer minor units (öre for SEK). This is the standard
 * accounting choice and matches every UI primitive that takes a `Money`
 * value: never round floats, never compare floats, never display floats.
 *
 * Status enums are TEXT with a CHECK constraint instead of a Postgres ENUM
 * because ENUM additions/renames need their own migrations and we'd rather
 * keep the migration file count down for a take-home.
 */

type AnyKysely = Kysely<Record<string, unknown>>;

export async function up(rawDb: Kysely<unknown>): Promise<void> {
  const db = rawDb as AnyKysely;

  await db.schema
    .createTable("bill")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) =>
      c.notNull().references("organization.id").onDelete("cascade")
    )
    .addColumn("uploadedByUserId", "text", (c) =>
      c.notNull().references("user.id").onDelete("restrict")
    )
    // R2 object key for the uploaded PDF. Lives in the bucket bound to the
    // Worker; signed/proxied via /api/bills/:id/file.
    .addColumn("fileKey", "text", (c) => c.notNull())
    .addColumn("fileName", "text", (c) => c.notNull())
    .addColumn("status", "text", (c) =>
      c
        .notNull()
        .defaultTo("pending")
        .check(sql`status in ('pending', 'approved', 'declined')`)
    )
    // Extracted invoice header fields. Nullable because parse can succeed
    // partially; the journal-entry generation can still proceed.
    .addColumn("supplierName", "text")
    .addColumn("invoiceNumber", "text")
    .addColumn("invoiceDate", "date")
    .addColumn("dueDate", "date")
    .addColumn("currency", "text", (c) => c.notNull().defaultTo("SEK"))
    .addColumn("subtotalMinor", "bigint")
    .addColumn("vatMinor", "bigint")
    .addColumn("totalMinor", "bigint")
    // Full extracted-data blob from the LLM — useful for debugging /
    // re-deriving fields without re-uploading the PDF.
    .addColumn("rawExtract", "jsonb")
    .addColumn("createdAt", sql`timestamptz`, (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("bill_organizationId_idx")
    .on("bill")
    .column("organizationId")
    .execute();
  await db.schema.createIndex("bill_status_idx").on("bill").column("status").execute();

  await db.schema
    .createTable("billLineItem")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("billId", "text", (c) => c.notNull().references("bill.id").onDelete("cascade"))
    .addColumn("lineNo", "integer", (c) => c.notNull())
    .addColumn("description", "text", (c) => c.notNull())
    .addColumn("quantity", "numeric(12, 3)")
    .addColumn("unitPriceMinor", "bigint")
    .addColumn("amountMinor", "bigint", (c) => c.notNull())
    .execute();

  await db.schema
    .createIndex("billLineItem_billId_idx")
    .on("billLineItem")
    .column("billId")
    .execute();

  await db.schema
    .createTable("journalEntry")
    .addColumn("id", "text", (c) => c.primaryKey())
    // 1:1 with bill — every bill produces exactly one proposed journal entry.
    // If we ever need re-proposing, we'd append a `version` column rather
    // than allow multiple rows per bill.
    .addColumn("billId", "text", (c) =>
      c.notNull().unique().references("bill.id").onDelete("cascade")
    )
    .addColumn("status", "text", (c) =>
      c
        .notNull()
        .defaultTo("proposed")
        .check(sql`status in ('proposed', 'approved', 'declined')`)
    )
    // LLM's explanation of why these accounts were chosen. Shown verbatim
    // in the UI so accountants can sanity-check the mapping.
    .addColumn("reasoning", "text")
    .addColumn("createdAt", sql`timestamptz`, (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("decidedAt", sql`timestamptz`)
    .addColumn("decidedByUserId", "text", (c) => c.references("user.id").onDelete("set null"))
    .execute();

  await db.schema
    .createTable("journalEntryPosting")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("journalEntryId", "text", (c) =>
      c.notNull().references("journalEntry.id").onDelete("cascade")
    )
    .addColumn("lineNo", "integer", (c) => c.notNull())
    .addColumn("accountCode", "text", (c) => c.notNull())
    .addColumn("accountName", "text", (c) => c.notNull())
    .addColumn("debitMinor", "bigint", (c) => c.notNull().defaultTo(0))
    .addColumn("creditMinor", "bigint", (c) => c.notNull().defaultTo(0))
    // Either side may be zero, but not both — every posting moves money one
    // direction. Caller is also responsible for total debit == total credit
    // across the entry; that's enforced in the route handler.
    .addCheckConstraint("posting_one_side_nonzero", sql`("debitMinor" = 0) <> ("creditMinor" = 0)`)
    .addCheckConstraint("posting_non_negative", sql`"debitMinor" >= 0 and "creditMinor" >= 0`)
    .execute();

  await db.schema
    .createIndex("journalEntryPosting_journalEntryId_idx")
    .on("journalEntryPosting")
    .column("journalEntryId")
    .execute();
}

export async function down(rawDb: Kysely<unknown>): Promise<void> {
  const db = rawDb as AnyKysely;
  await db.schema.dropTable("journalEntryPosting").ifExists().execute();
  await db.schema.dropTable("journalEntry").ifExists().execute();
  await db.schema.dropTable("billLineItem").ifExists().execute();
  await db.schema.dropTable("bill").ifExists().execute();
}
