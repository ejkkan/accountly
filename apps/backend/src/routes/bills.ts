import { Hono, type Context } from "hono";
import { sql } from "kysely";
import { requireSession, type AuthVariables } from "../middleware/auth";
import type { Env } from "../index";
import { parseBill } from "../lib/parse-bill";
import type { ParsedBill } from "../lib/journal-schema";
import { log, startTimer } from "../lib/log";

type BillsContext = Context<{ Bindings: Env; Variables: AuthVariables }>;

function pdfKey(organizationId: string, billId: string): string {
  return `${organizationId}/bills/${billId}.pdf`;
}

/**
 * Shared body of /approve and /decline. Flips both the journal entry's
 * status and the bill's status atomically.
 *
 * Idempotent: if the journal entry is already in the requested terminal
 * state we just return current state (200). If it's in the *other*
 * terminal state, we still return 200 with the existing state — the UI
 * never offers both buttons once a decision is made, so the only way to
 * hit this is a stale tab racing another reviewer. Matching that race
 * with the existing state is safer than "you can't undo."
 */
async function decide(c: BillsContext, decision: "approved" | "declined") {
  const db = c.get("db");
  const organizationId = c.get("organizationId");
  const userId = c.get("userId");
  // The two routes that call decide both pin :id, so this never returns
  // undefined at runtime — but the generic `Context` type doesn't carry
  // the route pattern so we narrow defensively.
  const id = c.req.param("id");
  if (!id) return c.json({ error: "bad request" } as const, 400);

  const bill = await db
    .selectFrom("bill")
    .select(["id", "status"])
    .where("id", "=", id)
    .where("organizationId", "=", organizationId)
    .executeTakeFirst();
  if (!bill) {
    return c.json({ error: "not found" } as const, 404);
  }

  const journalEntry = await db
    .selectFrom("journalEntry")
    .select(["id", "status"])
    .where("billId", "=", id)
    .executeTakeFirst();
  if (!journalEntry) {
    return c.json({ error: "no journal entry to decide on" } as const, 409);
  }

  // Already-terminal: return current state, don't re-stamp decidedAt.
  if (journalEntry.status === "approved" || journalEntry.status === "declined") {
    return c.json({ ok: true as const, status: journalEntry.status });
  }

  const now = new Date();
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("journalEntry")
      .set({ status: decision, decidedAt: now, decidedByUserId: userId })
      .where("id", "=", journalEntry.id)
      .execute();
    await trx
      .updateTable("bill")
      .set({ status: decision })
      .where("id", "=", bill.id)
      .execute();
  });

  log("bill.decided", { billId: id, decision, byUserId: userId });
  return c.json({ ok: true as const, status: decision });
}

/**
 * Bill CRUD. Every route is session-gated; the middleware attaches
 * `userId` + `organizationId` + a per-request Kysely instance.
 *
 * Routes:
 *   POST   /                 multipart upload → R2 put → Claude parse →
 *                            bill + line items + journal entry + postings
 *                            in a single transaction
 *   GET    /                 list for the active org
 *   GET    /:id              bill + line items + journal entry + postings
 *   GET    /:id/file         streams the PDF from R2
 *   POST   /:id/approve      flips journalEntry.status + bill.status to
 *                            "approved"; idempotent if already terminal
 *   POST   /:id/decline      same but to "declined"
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

    const body = await c.req.parseBody<{ file?: File }>();
    const file = body.file;
    if (!file || typeof file === "string") {
      return c.json({ error: "missing file" }, 400);
    }
    if (file.type !== "application/pdf") {
      return c.json({ error: "expected application/pdf" }, 400);
    }

    // Read once, reuse for R2 + Claude. Worker memory limit is plenty for a
    // single invoice PDF (the assignment PDF is 2KB).
    const bytes = new Uint8Array(await file.arrayBuffer());

    const id = crypto.randomUUID();
    const key = pdfKey(organizationId, id);

    log("bill.upload.received", {
      billId: id,
      orgId: organizationId,
      fileName: file.name,
      sizeBytes: bytes.byteLength,
    });

    const r2Timer = startTimer();
    await c.env.INVOICES.put(key, bytes, {
      httpMetadata: { contentType: "application/pdf" },
    });
    log("bill.r2.stored", { billId: id, key, ms: r2Timer() });

    log("bill.parse.start", { billId: id, model: "claude-sonnet-4-6" });
    const parseTimer = startTimer();
    let parsed: ParsedBill;
    try {
      parsed = await parseBill({ ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY }, bytes);
    } catch (err) {
      // Don't poison the bucket; surface the parse failure cleanly so the
      // UI can show "retry" later. The R2 object stays so a retry can
      // re-parse without re-uploading.
      const message = err instanceof Error ? err.message : "parse failed";
      log("bill.parse.failed", { billId: id, ms: parseTimer(), error: message });
      return c.json({ error: `parse failed: ${message}`, fileKey: key }, 502);
    }
    log("bill.parse.done", {
      billId: id,
      ms: parseTimer(),
      lineItems: parsed.extracted.lineItems.length,
      postings: parsed.proposal.postings.length,
      totalMinor: parsed.extracted.totalMinor,
    });

    // Persist bill + line items + journal entry + postings atomically.
    const persistTimer = startTimer();
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("bill")
        .values({
          id,
          organizationId,
          uploadedByUserId: userId,
          fileKey: key,
          fileName: file.name,
          status: "pending",
          currency: parsed.extracted.currency,
          supplierName: parsed.extracted.supplierName,
          invoiceNumber: parsed.extracted.invoiceNumber,
          invoiceDate: parsed.extracted.invoiceDate,
          dueDate: parsed.extracted.dueDate,
          subtotalMinor: parsed.extracted.subtotalMinor,
          vatMinor: parsed.extracted.vatMinor,
          totalMinor: parsed.extracted.totalMinor,
          rawExtract: sql`${JSON.stringify(parsed.extracted)}::jsonb`,
        })
        .execute();

      if (parsed.extracted.lineItems.length > 0) {
        await trx
          .insertInto("billLineItem")
          .values(
            parsed.extracted.lineItems.map((li) => ({
              id: crypto.randomUUID(),
              billId: id,
              lineNo: li.lineNo,
              description: li.description,
              quantity: li.quantity,
              unitPriceMinor: li.unitPriceMinor,
              amountMinor: li.amountMinor,
            }))
          )
          .execute();
      }

      const journalEntryId = crypto.randomUUID();
      await trx
        .insertInto("journalEntry")
        .values({
          id: journalEntryId,
          billId: id,
          status: "proposed",
          reasoning: parsed.proposal.reasoning,
        })
        .execute();

      await trx
        .insertInto("journalEntryPosting")
        .values(
          parsed.proposal.postings.map((p) => ({
            id: crypto.randomUUID(),
            journalEntryId,
            lineNo: p.lineNo,
            accountCode: p.accountCode,
            accountName: p.accountName,
            debitMinor: p.debitMinor,
            creditMinor: p.creditMinor,
          }))
        )
        .execute();
    });
    log("bill.persisted", {
      billId: id,
      lineItems: parsed.extracted.lineItems.length,
      postings: parsed.proposal.postings.length,
      ms: persistTimer(),
    });

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

    const [lineItems, journalEntry] = await Promise.all([
      db
        .selectFrom("billLineItem")
        .selectAll()
        .where("billId", "=", id)
        .orderBy("lineNo", "asc")
        .execute(),
      db.selectFrom("journalEntry").selectAll().where("billId", "=", id).executeTakeFirst(),
    ]);

    const postings = journalEntry
      ? await db
          .selectFrom("journalEntryPosting")
          .selectAll()
          .where("journalEntryId", "=", journalEntry.id)
          .orderBy("lineNo", "asc")
          .execute()
      : [];

    return c.json({ bill, lineItems, journalEntry: journalEntry ?? null, postings });
  })

  .post("/:id/approve", async (c) => decide(c, "approved"))
  .post("/:id/decline", async (c) => decide(c, "declined"))

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
        "content-disposition": `inline; filename="${bill.fileName.replace(/"/g, "")}"`,
        "cache-control": "private, max-age=60",
      },
    });
  });
