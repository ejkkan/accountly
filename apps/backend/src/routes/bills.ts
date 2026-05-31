import { Hono, type Context } from "hono";
import { sql, type Transaction } from "kysely";
import { requireSession, type AuthVariables } from "../middleware/auth";
import type { Env } from "../index";
import { parseBill } from "../lib/parse-bill";
import { validateProposal } from "../lib/validate-proposal";
import { accountName } from "../lib/coa";
import { log, startTimer } from "../lib/log";
import { BadRequest, Conflict, NotFound, Unprocessable, Upstream } from "../lib/errors";
import { assertCan, permissionsFor } from "../lib/bill-states";
import type { ParsedBillOkT } from "../lib/journal-schema";
import type { Database } from "../db";

type BillsContext = Context<{ Bindings: Env; Variables: AuthVariables }>;
type Trx = Transaction<Database>;

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function pdfKey(organizationId: string, billId: string): string {
  return `${organizationId}/bills/${billId}.pdf`;
}

/**
 * Insert the LLM's extraction + proposal as line items + journal entry +
 * postings. Called from the analyze route's onFinish for both first
 * analysis and reparse; caller wraps in a transaction.
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
        accountName: accountName(p.accountCode),
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
 *   POST   /                 multipart upload, one PDF. Synchronous: parse
 *                            (model run to completion) → on success R2 put +
 *                            persist bill/line items/entry/postings as
 *                            `pending`. A rejected (non-invoice) document
 *                            422s and stores nothing. Returns `{ billId }`.
 *   GET    /                 list for the active org
 *   GET    /:id              bill + line items + journal entry + postings
 *                            (journalEntry includes the decided-by user's
 *                            name for the audit-trail UI line)
 *   GET    /:id/file         streams the PDF from R2
 *   POST   /:id/reparse      re-runs the agent on the stored PDF; replaces
 *                            line items + journal entry + postings; resets
 *                            bill.status to `pending`
 *   POST   /:id/approve      flips journalEntry.status + bill.status to
 *                            "approved"; idempotent if already terminal
 *   POST   /:id/decline      same but to "declined"
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

    // Multipart upload — one PDF. Synchronous: parse → (on success) store +
    // persist in one request, then the client redirects to the bill detail
    // with the proposal already in place.
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!(file instanceof File)) {
      throw BadRequest("missing_file", "Attach a PDF in the `file` field of a multipart form.");
    }
    if (file.type !== "application/pdf") {
      throw BadRequest("not_pdf", "Only PDF files are accepted.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_PDF_BYTES) {
      throw BadRequest("too_large", "PDF exceeds the 10 MB upload limit.");
    }
    const fileName = file.name || "invoice.pdf";

    log("bill.upload.received", { orgId: organizationId, fileName, sizeBytes: bytes.byteLength });

    // Parse FIRST, from the in-memory bytes. We only touch R2 + the DB on a
    // successful proposal, so a rejected (non-invoice) document leaves
    // nothing behind — no orphan blob, no orphan row.
    const parseTimer = startTimer();
    let parsed;
    try {
      parsed = await parseBill({ ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY }, bytes);
    } catch (err) {
      const message = err instanceof Error ? err.message : "parse failed";
      log("bill.parse.failed", { ms: parseTimer(), error: message });
      throw Upstream("parse_failed", "We couldn't read this invoice. Try again in a moment.");
    }

    if (parsed.kind === "not_an_invoice") {
      log("bill.parse.rejected", { detail: parsed.detail, ms: parseTimer() });
      throw Unprocessable("not_an_invoice", parsed.detail);
    }

    log("bill.parse.done", {
      ms: parseTimer(),
      lineItems: parsed.extracted.lineItems.length,
      postings: parsed.proposal.postings.length,
    });

    // Authoritative accounting gate — balance, single-direction, known
    // accounts. The schema only checks shape; this decides whether the
    // proposal is bookable. Invalid → 422, nothing stored.
    const validation = validateProposal(parsed.proposal);
    if (!validation.ok) {
      log("bill.parse.invalid", { errors: validation.errors });
      throw Unprocessable(
        "invalid_proposal",
        `The proposed entry didn't validate: ${validation.errors.join(" ")}`
      );
    }

    const id = crypto.randomUUID();
    const key = pdfKey(organizationId, id);

    const r2Timer = startTimer();
    await c.env.INVOICES.put(key, bytes, { httpMetadata: { contentType: "application/pdf" } });
    log("bill.r2.stored", { billId: id, key, ms: r2Timer() });

    const persistTimer = startTimer();
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("bill")
        .values({
          id,
          organizationId,
          uploadedByUserId: userId,
          fileKey: key,
          fileName,
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
    log("bill.persisted", { billId: id, ms: persistTimer() });

    return c.json({ billId: id });
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

    // Surface supplier tax identifiers next to the rest of the extracted
    // header fields. They live inside the rawExtract jsonb blob today (see
    // ExtractedBill in lib/journal-schema.ts); promoting them to top-level
    // bill columns is the next step when the supplier-entity work lands.
    // Older bills parsed before this field existed return null naturally.
    const taxIds = (bill.rawExtract ?? null) as {
      supplierOrgNumber?: string | null;
      supplierVatNumber?: string | null;
    } | null;

    return c.json({
      bill: {
        ...bill,
        supplierOrgNumber: taxIds?.supplierOrgNumber ?? null,
        supplierVatNumber: taxIds?.supplierVatNumber ?? null,
      },
      lineItems,
      journalEntry: journalEntry ?? null,
      postings,
      // Derived from bill.status via the state machine — UI uses these to
      // show/hide Analyze, Delete, Approve, Decline buttons. Single source
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
      .select(["id", "status", "fileKey"])
      .where("id", "=", id)
      .where("organizationId", "=", organizationId)
      .executeTakeFirst();
    if (!bill) throw NotFound("That bill isn't in your workspace.");

    assertCan(
      bill.status,
      "canReparse",
      `Only pending bills can be re-parsed — this one is ${bill.status}.`
    );

    // Pull the original PDF straight from R2 — no re-upload needed.
    const obj = await c.env.INVOICES.get(bill.fileKey);
    if (!obj) throw NotFound("The original PDF is no longer in storage.");
    const bytes = new Uint8Array(await obj.arrayBuffer());

    log("bill.reparse.start", { billId: id });
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
      log("bill.reparse.rejected", { billId: id, detail: parsed.detail, ms: parseTimer() });
      throw Unprocessable("not_an_invoice", parsed.detail);
    }

    log("bill.reparse.done", {
      billId: id,
      ms: parseTimer(),
      lineItems: parsed.extracted.lineItems.length,
      postings: parsed.proposal.postings.length,
    });

    const validation = validateProposal(parsed.proposal);
    if (!validation.ok) {
      log("bill.reparse.invalid", { billId: id, errors: validation.errors });
      throw Unprocessable(
        "invalid_proposal",
        `The proposed entry didn't validate: ${validation.errors.join(" ")}`
      );
    }

    // Replace the old proposal atomically: wipe the journal entry + line
    // items (postings cascade via FK), refresh the header, re-insert, reset
    // to `pending` since there's a fresh proposal to decide on.
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
