import { Hono } from "hono";
import { requireSession, type AuthVariables } from "../middleware/auth";
import type { Env } from "../index";
import { NotFound } from "../lib/errors";

/**
 * Supplier directory. Read-only: the supplier rows are created/maintained by
 * `findOrCreateSupplier` during bill upload (lib/suppliers.ts) — this route
 * just lists them and drills into one vendor's invoices.
 *
 * Routes:
 *   GET /        every supplier in the org + how many bills point at each
 *   GET /:id     one supplier + its bills (newest first)
 *
 * Org-scoped throughout, same as bills.
 */
export const suppliersRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
  .use("*", requireSession())

  .get("/", async (c) => {
    const db = c.get("db");
    const organizationId = c.get("organizationId");

    const rows = await db
      .selectFrom("supplier")
      .leftJoin("bill", "bill.supplierId", "supplier.id")
      .select((eb) => [
        "supplier.id",
        "supplier.name",
        "supplier.orgNumber",
        "supplier.vatNumber",
        eb.fn.count("bill.id").as("billCount"),
      ])
      .where("supplier.organizationId", "=", organizationId)
      .groupBy(["supplier.id", "supplier.name", "supplier.orgNumber", "supplier.vatNumber"])
      .orderBy("supplier.name", "asc")
      .execute();

    // count() comes back as string|bigint depending on the driver — coerce to
    // a plain number so the typed client gets `billCount: number`.
    const suppliers = rows.map((r) => ({ ...r, billCount: Number(r.billCount) }));
    return c.json({ suppliers });
  })

  .get("/:id", async (c) => {
    const db = c.get("db");
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");

    const supplier = await db
      .selectFrom("supplier")
      .select(["id", "name", "orgNumber", "vatNumber", "createdAt"])
      .where("id", "=", id)
      .where("organizationId", "=", organizationId)
      .executeTakeFirst();
    if (!supplier) throw NotFound("That supplier isn't in your workspace.");

    const bills = await db
      .selectFrom("bill")
      .select([
        "id",
        "fileName",
        "status",
        "invoiceNumber",
        "invoiceDate",
        "currency",
        "totalMinor",
        "createdAt",
      ])
      .where("supplierId", "=", id)
      .where("organizationId", "=", organizationId)
      .orderBy("createdAt", "desc")
      .execute();

    return c.json({ supplier, bills });
  });
