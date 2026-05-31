import { Hono } from "hono";
import { requireSession, type AuthVariables } from "../middleware/auth";
import type { Env } from "../index";

/**
 * Build the R2 object key for a bill's PDF. Hierarchical so a future bulk
 * delete on an organization can do `list({ prefix })` cleanly.
 */
function pdfKey(organizationId: string, billId: string): string {
  return `${organizationId}/bills/${billId}.pdf`;
}

/**
 * Bill CRUD. Every route under here is session-gated; the middleware
 * attaches `userId` + `organizationId` + a per-request Kysely instance to
 * the context.
 *
 * Routes:
 *   POST   /             multipart upload → R2 put + bill row, returns the bill
 *   GET    /             list for the active org
 *   GET    /:id          single bill + line items
 *   GET    /:id/file     streams the PDF from R2 (no auth-gate skip — the URL
 *                        is meaningless without the cookie)
 *
 * Kept as one chained expression so the route tree survives into AppType.
 */
export const billsRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
  .use("*", requireSession())

  .get("/", async (c) => {
    const db = c.get("db");
    const organizationId = c.get("organizationId");

    const bills = await db
      .selectFrom("bill")
      .select([
        "id",
        "fileName",
        "status",
        "supplierName",
        "invoiceNumber",
        "invoiceDate",
        "currency",
        "totalMinor",
        "createdAt",
      ])
      .where("organizationId", "=", organizationId)
      .orderBy("createdAt", "desc")
      .execute();

    return c.json({ bills });
  })

  .post("/", async (c) => {
    const db = c.get("db");
    const organizationId = c.get("organizationId");
    const userId = c.get("userId");

    // Hono's parseBody returns `Record<string, string | File | ...>` —
    // properly typed File values, unlike `c.req.formData()` which inherits
    // workers-types' string-only FormData.get signature.
    const body = await c.req.parseBody<{ file?: File }>();
    const file = body.file;
    if (!file || typeof file === "string") {
      return c.json({ error: "missing file" }, 400);
    }
    if (file.type !== "application/pdf") {
      return c.json({ error: "expected application/pdf" }, 400);
    }

    const id = crypto.randomUUID();
    const key = pdfKey(organizationId, id);

    await c.env.INVOICES.put(key, file.stream(), {
      httpMetadata: { contentType: "application/pdf" },
    });

    await db
      .insertInto("bill")
      .values({
        id,
        organizationId,
        uploadedByUserId: userId,
        fileKey: key,
        fileName: file.name,
        status: "pending",
        currency: "SEK",
      })
      .execute();

    const bill = await db
      .selectFrom("bill")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();

    return c.json({ bill }, 201);
  })

  .get("/:id", async (c) => {
    const db = c.get("db");
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");

    const bill = await db
      .selectFrom("bill")
      .selectAll()
      .where("id", "=", id)
      .where("organizationId", "=", organizationId)
      .executeTakeFirst();

    if (!bill) {
      return c.json({ error: "not found" }, 404);
    }

    const lineItems = await db
      .selectFrom("billLineItem")
      .selectAll()
      .where("billId", "=", id)
      .orderBy("lineNo", "asc")
      .execute();

    return c.json({ bill, lineItems });
  })

  .get("/:id/file", async (c) => {
    const db = c.get("db");
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");

    const bill = await db
      .selectFrom("bill")
      .select(["fileKey", "fileName"])
      .where("id", "=", id)
      .where("organizationId", "=", organizationId)
      .executeTakeFirst();

    if (!bill) {
      return c.json({ error: "not found" }, 404);
    }

    const obj = await c.env.INVOICES.get(bill.fileKey);
    if (!obj) {
      return c.json({ error: "file gone" }, 404);
    }

    return new Response(obj.body, {
      headers: {
        "content-type": "application/pdf",
        // `inline` so the browser renders it in the <iframe>; the filename is
        // only used if the user explicitly downloads.
        "content-disposition": `inline; filename="${bill.fileName.replace(/"/g, "")}"`,
        "cache-control": "private, max-age=60",
      },
    });
  });
