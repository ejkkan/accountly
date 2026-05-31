import { Kysely, sql } from "kysely";

/**
 * Suppliers — promote the vendor from a denormalized `bill.supplierName` string
 * to a first-class, org-scoped entity that bills reference by FK.
 *
 * Additive on top of 0002 (never edit an applied migration). The supplier's
 * name / org.nr / VAT now live on the supplier row — a single source of truth
 * — so `bill.supplierName` is replaced by `bill.supplierId`.
 */

type AnyKysely = Kysely<Record<string, unknown>>;

export async function up(rawDb: Kysely<unknown>): Promise<void> {
  const db = rawDb as AnyKysely;

  // Org-scoped supplier master. `name` is the only required field; org.nr / VAT
  // are the strong identifiers but aren't always printed on an invoice.
  await db.schema
    .createTable("supplier")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("organizationId", "text", (c) =>
      c.notNull().references("organization.id").onDelete("cascade")
    )
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("orgNumber", "text")
    .addColumn("vatNumber", "text")
    .addColumn("createdAt", sql`timestamptz`, (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updatedAt", sql`timestamptz`, (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("supplier_organizationId_idx")
    .on("supplier")
    .column("organizationId")
    .execute();

  // Partial-unique per identifier: a workspace can't hold two suppliers with
  // the same org.nr (or VAT), but identifier-less (name-only) suppliers are
  // still allowed. This is what makes find-or-create safe.
  await sql`create unique index "supplier_org_orgNumber_unique" on "supplier" ("organizationId", "orgNumber") where "orgNumber" is not null`.execute(
    db
  );
  await sql`create unique index "supplier_org_vatNumber_unique" on "supplier" ("organizationId", "vatNumber") where "vatNumber" is not null`.execute(
    db
  );

  // Link bills to the supplier entity, then drop the denormalized name column.
  // Greenfield here, so no backfill — a system with live data would first
  // INSERT distinct suppliers from existing bills and UPDATE bill.supplierId
  // before dropping the old column.
  await db.schema
    .alterTable("bill")
    .addColumn("supplierId", "text", (c) => c.references("supplier.id").onDelete("set null"))
    .execute();
  await db.schema.createIndex("bill_supplierId_idx").on("bill").column("supplierId").execute();
  await db.schema.alterTable("bill").dropColumn("supplierName").execute();
}

export async function down(rawDb: Kysely<unknown>): Promise<void> {
  const db = rawDb as AnyKysely;
  await db.schema.alterTable("bill").addColumn("supplierName", "text").execute();
  // Dropping the column also drops its index + FK.
  await db.schema.alterTable("bill").dropColumn("supplierId").execute();
  await db.schema.dropTable("supplier").ifExists().execute();
}
