import { Hono, type Context } from "hono";
import { sql, type Transaction } from "kysely";
import { requireSession, type AuthVariables } from "../middleware/auth";
import type { Env } from "../index";
import { parseBill } from "../lib/parse-bill";
import { log, startTimer } from "../lib/log";
import { BadRequest, Conflict, NotFound, Unprocessable, Upstream } from "../lib/errors";
import { assertCan, permissionsFor } from "../lib/bill-states";
import type { ParsedBillOkT } from "../lib/journal-schema";
import type { Database } from "../db";

type BillsContext = Context<{ Bindings: Env; Variables: AuthVariables }>;
type Trx = Transaction<Database>;

function pdfKey(organizationId: string, billId: string): string {
  return `${organizationId}/bills/${billId}.pdf`;
}

/**
 * Insert the LLM's extraction + proposal as line items + journal entry +
 * postings. Shared by the initial POST and POST /:id/reparse; caller wraps
 * in a transaction.
 */
async function insertProposal(trx: Trx, billId: string, parsed: ParsedBillOkT): Promise<void> {
  if (parsed.extracted.lineItems.length > 0) {
    await trx
      .insertInto("billLineItem")
      .values(
        parsed.extracted.lineItems.map((li) => ({
          id: crypto.randomUUID(),
          billId,
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
      billId,
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
}

/**
 * Shared body of /approve and /decline. Flips both the journal entry's
 * status and the bill's status atomically. State guard via `assertCan`
 * — a stale tab racing another reviewer gets a clean 409 instead of a
 * silent no-op.
 */
async function decide(c: BillsContext, decision: "approved" | "declined") {
  const db = c.get("db");
  const organizationId = c.get("organizationId");
  const userId = c.get("userId");
  const id = c.req.param("id");
  if (!id) throw BadRequest("missing_id", "Bill id missing from the URL.");

  const bill = await db
    .selectFrom("bill")
    .select(["id", "status"])
    .where("id", "=", id)
    .where("organizationId", "=", organizationId)
    .executeTakeFirst();
  if (!bill) throw NotFound("That bill isn't in your workspace.");

  assertCan(
    bill.status,
    "canDecide",
    `This bill is already ${bill.status} — refresh to see the latest state.`
  );

  const journalEntry = await db
    .selectFrom("journalEntry")
    .select(["id", "status"])
    .where("billId", "=", id)
    .executeTakeFirst();
  if (!journalEntry) {
    throw Conflict("no_journal_entry", "This bill doesn't have a journal entry to decide on.");
  }

  const now = new Date();
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("journalEntry")
      .set({ status: decision, decidedAt: now, decidedByUserId: userId })
      .where("id", "=", journalEntry.id)
      .execute();
    await trx.updateTable("bill").set({ status: decision }).where("id", "=", bill.id).execute();
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
 *                            (journalEntry includes the decided-by user's
 *                            name for the audit-trail UI line)
 *   GET    /:id/file         streams the PDF from R2
 *   POST   /:id/approve      flips journalEntry.status + bill.status to
 *                            "approved"; idempotent if already terminal
 *   POST   /:id/decline      same but to "declined"
 *   POST   /:id/reparse      re-runs Claude on the existing R2 PDF;
 *                            replaces line items + journal entry +
 *                            postings; resets bill.status to "pending"
 *   DELETE /:id              removes R2 object + cascades the bill row
 *                            through line items / journal entry / postings
 *
 * Errors leave via `throw new AppError(...)` so the root `.onError` handler
 * can emit the single error shape. Don't `return c.json({error})` — that
 * pollutes the route response type seen by `hc<AppType>`.
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
      throw BadRequest("missing_file", "Please attach a PDF to upload.");
    }
    if (file.type !== "application/pdf") {
      throw BadRequest("wrong_type", "Only PDF files are supported.");
    }

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
    let parsed;
    try {
      parsed = await parseBill({ ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY }, bytes);
    } catch (err) {
      const message = err instanceof Error ? err.message : "parse failed";
      log("bill.parse.failed", { billId: id, ms: parseTimer(), error: message });
      throw Upstream("parse_failed", "We couldn't read this invoice. Try again in a moment.");
    }

    if (parsed.kind === "not_an_invoice") {
      log("bill.parse.rejected", {
        billId: id,
        reason: parsed.reason,
        detail: parsed.detail,
        ms: parseTimer(),
      });
      throw Unprocessable(`parse_${parsed.reason}`, parsed.detail);
    }

    log("bill.parse.done", {
      billId: id,
      ms: parseTimer(),
      lineItems: parsed.extracted.lineItems.length,
      postings: parsed.proposal.postings.length,
      totalMinor: parsed.extracted.totalMinor,
    });

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
      await insertProposal(trx, id, parsed);
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

    if (!bill) throw NotFound("That bill isn't in your workspace.");

    // Left-join the user table on decided-by so the UI can render
    // "Approved by Erik on 2026-05-31" without a second round-trip.
    const [lineItems, journalEntry] = await Promise.all([
      db
        .selectFrom("billLineItem")
        .selectAll()
        .where("billId", "=", id)
        .orderBy("lineNo", "asc")
        .execute(),
      db
        .selectFrom("journalEntry")
        .leftJoin("user", "user.id", "journalEntry.decidedByUserId")
        .select([
          "journalEntry.id",
          "journalEntry.billId",
          "journalEntry.status",
          "journalEntry.reasoning",
          "journalEntry.decidedAt",
          "journalEntry.decidedByUserId",
          "journalEntry.createdAt",
          "user.name as decidedByName",
        ])
        .where("journalEntry.billId", "=", id)
        .executeTakeFirst(),
    ]);

    const postings = journalEntry
      ? await db
          .selectFrom("journalEntryPosting")
          .selectAll()
          .where("journalEntryId", "=", journalEntry.id)
          .orderBy("lineNo", "asc")
          .execute()
      : [];

    return c.json({
      bill,
      lineItems,
      journalEntry: journalEntry ?? null,
      postings,
      // Derived from bill.status via the state machine — UI uses these to
      // show/hide Reparse, Delete, Approve, Decline buttons. Single source
      // of truth lives in lib/bill-states.ts.
      permissions: permissionsFor(bill.status),
    });
  })

  .post("/:id/approve", async (c) => decide(c, "approved"))
  .post("/:id/decline", async (c) => decide(c, "declined"))

  .post("/:id/reparse", async (c) => {
    const db = c.get("db");
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");
    if (!id) throw BadRequest("missing_id", "Bill id missing from the URL.");

    const bill = await db
      .selectFrom("bill")
      .select(["id", "status", "fileKey", "fileName"])
      .where("id", "=", id)
      .where("organizationId", "=", organizationId)
      .executeTakeFirst();
    if (!bill) throw NotFound("That bill isn't in your workspace.");

    assertCan(
      bill.status,
      "canReparse",
      `Only pending bills can be re-parsed — this one is ${bill.status}.`
    );

    log("bill.reparse.start", { billId: id, key: bill.fileKey });

    // Pull the original PDF straight from R2 — no need for the user to
    // re-upload. Saves bandwidth + keeps the demo snappy.
    const obj = await c.env.INVOICES.get(bill.fileKey);
    if (!obj) {
      throw NotFound("The original PDF is no longer in storage.");
    }
    const bytes = new Uint8Array(await obj.arrayBuffer());

    const parseTimer = startTimer();
    let parsed;
    try {
      parsed = await parseBill({ ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY }, bytes);
    } catch (err) {
      const message = err instanceof Error ? err.message : "parse failed";
      log("bill.reparse.failed", { billId: id, ms: parseTimer(), error: message });
      throw Upstream("parse_failed", "We couldn't re-read this invoice. Try again in a moment.");
    }

    if (parsed.kind === "not_an_invoice") {
      log("bill.reparse.rejected", {
        billId: id,
        reason: parsed.reason,
        detail: parsed.detail,
        ms: parseTimer(),
      });
      throw Unprocessable(`parse_${parsed.reason}`, parsed.detail);
    }

    log("bill.reparse.done", {
      billId: id,
      ms: parseTimer(),
      lineItems: parsed.extracted.lineItems.length,
      postings: parsed.proposal.postings.length,
    });

    // Replace old data atomically: wipe line items + journal entry (postings
    // cascade via FK), update bill header fields, re-insert. Bill status
    // resets to "pending" because we have a fresh proposal needing decision.
    const persistTimer = startTimer();
    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom("journalEntry").where("billId", "=", id).execute();
      await trx.deleteFrom("billLineItem").where("billId", "=", id).execute();

      await trx
        .updateTable("bill")
        .set({
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
        .where("id", "=", id)
        .execute();

      await insertProposal(trx, id, parsed);
    });
    log("bill.reparse.persisted", { billId: id, ms: persistTimer() });

    return c.json({ ok: true as const, billId: id });
  })

  .delete("/:id", async (c) => {
    const db = c.get("db");
    const organizationId = c.get("organizationId");
    const id = c.req.param("id");
    if (!id) throw BadRequest("missing_id", "Bill id missing from the URL.");

    const bill = await db
      .selectFrom("bill")
      .select(["id", "status", "fileKey"])
      .where("id", "=", id)
      .where("organizationId", "=", organizationId)
      .executeTakeFirst();
    if (!bill) throw NotFound("That bill isn't in your workspace.");

    assertCan(
      bill.status,
      "canDelete",
      "Approved bills can't be deleted — the journal entry is in the ledger. Reverse it instead."
    );

    log("bill.delete.start", { billId: id, orgId: organizationId });

    // R2 cleanup before the row drops — if R2 returns an error, log it but
    // keep going. An orphan object in the bucket is recoverable; refusing
    // to delete the row because R2 hiccupped is not. Belt-and-braces: a
    // future per-org sweeper can `list({ prefix: orgId })` and reconcile.
    const r2Timer = startTimer();
    try {
      await c.env.INVOICES.delete(bill.fileKey);
      log("bill.r2.deleted", { billId: id, key: bill.fileKey, ms: r2Timer() });
    } catch (err) {
      log("bill.r2.delete_failed", {
        billId: id,
        key: bill.fileKey,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Single DELETE — line items / journal entry / postings cascade via the
    // FKs in migrations/0002_bills.ts. One row out, four tables cleared.
    const dbTimer = startTimer();
    const result = await db
      .deleteFrom("bill")
      .where("id", "=", id)
      .where("organizationId", "=", organizationId)
      .executeTakeFirst();
    log("bill.db.deleted", {
      billId: id,
      ms: dbTimer(),
      rowsAffected: Number(result.numDeletedRows),
    });

    return c.json({ ok: true as const, billId: id });
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

    if (!bill) throw NotFound("That bill isn't in your workspace.");

    const obj = await c.env.INVOICES.get(bill.fileKey);
    if (!obj) throw NotFound("The PDF is missing from storage.");

    return new Response(obj.body, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${bill.fileName.replace(/"/g, "")}"`,
        "cache-control": "private, max-age=60",
      },
    });
  });
