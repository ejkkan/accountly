import { z } from "zod";

/**
 * The schema for what the parse agent returns — the single Zod contract
 * `generateObject` uses to BOTH force + runtime-validate the model's JSON and
 * to type the result (`ParsedBill`). It's a discriminated union:
 *
 *   { kind: "ok", extracted, proposal }  — a bookable supplier invoice
 *   { kind: "not_an_invoice", detail }    — not something we can book (a
 *                                           receipt, brochure, unreadable
 *                                           scan); `detail` is one sentence the
 *                                           accountant reads verbatim
 *
 * The schema validates STRUCTURE only (types, integer minor units, lengths).
 * The accounting rules — debit/credit XOR, known account codes, and the
 * debits-equal-credits balance — live in `validateProposal`
 * (lib/validate-proposal.ts): prompt-independent, unit-tested, and the route's
 * hard gate before persisting.
 *
 * All money is integer minor units (öre / cents).
 */

const MoneyMinor = z
  .number()
  .int("Must be integer minor units (öre)")
  .nonnegative("Money cannot be negative");

export const ExtractedLineItem = z.object({
  lineNo: z.number().int().min(1),
  description: z.string().min(1),
  quantity: z.number().nullable(),
  unitPriceMinor: MoneyMinor.nullable(),
  amountMinor: MoneyMinor,
});

export const ExtractedBill = z.object({
  supplierName: z.string().nullable(),
  // Swedish organisationsnummer — 10 digits, canonical "NNNNNN-NNNN".
  // Accepts the bare 10-digit form too since invoices print both ways. Null
  // when the supplier isn't Swedish or the number isn't printed. Captured
  // here for the deferred supplier-entity work (see README) — flows into
  // bill.rawExtract today, ready to be promoted to its own column when we
  // build dedup / supplier matching.
  supplierOrgNumber: z
    .string()
    .regex(/^\d{6}-?\d{4}$/, "10 digits, optional hyphen after the 6th (e.g. 559876-5432)")
    .nullable(),
  // Country-prefixed VAT registration number (e.g. SE559876543201, DE123456789).
  // Distinct from supplierOrgNumber — Swedish VAT is the orgnr's digits with
  // "SE" prefix and "01" suffix, so the prompt explicitly disambiguates them.
  supplierVatNumber: z
    .string()
    .regex(/^[A-Z]{2}[A-Za-z0-9]+$/, "Country prefix + alphanumeric (e.g. SE559876543201)")
    .nullable(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date YYYY-MM-DD")
    .nullable(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date YYYY-MM-DD")
    .nullable(),
  currency: z.string().length(3, "ISO 4217 (e.g. SEK)").default("SEK"),
  subtotalMinor: MoneyMinor.nullable(),
  vatMinor: MoneyMinor.nullable(),
  totalMinor: MoneyMinor.nullable(),
  lineItems: z.array(ExtractedLineItem).min(1, "At least one line item"),
});

/**
 * Posting shape — a debit and/or credit against one account. The model
 * returns only the account *code*; the human-readable name is derived from
 * the chart at persist time (`accountName` in lib/coa), so a code can't be
 * mislabeled. The "exactly one direction" rule and account-code membership
 * are enforced in `validateProposal`, not here.
 */
const ProposedPosting = z.object({
  lineNo: z.number().int().min(1),
  accountCode: z.string(),
  debitMinor: MoneyMinor,
  creditMinor: MoneyMinor,
});

export const ProposedJournalEntry = z.object({
  reasoning: z.string().min(1, "Reasoning required").max(2000, "Keep reasoning under 2000 chars"),
  postings: z.array(ProposedPosting).min(2, "At least two postings"),
});

const ParsedBillOk = z.object({
  kind: z.literal("ok"),
  extracted: ExtractedBill,
  proposal: ProposedJournalEntry,
});

const ParsedBillNotInvoice = z.object({
  kind: z.literal("not_an_invoice"),
  detail: z.string().min(1, "Need a sentence the accountant can read").max(500),
});

export const ParsedBillSchema = z.discriminatedUnion("kind", [ParsedBillOk, ParsedBillNotInvoice]);

export type ParsedBill = z.infer<typeof ParsedBillSchema>;
export type ParsedBillOkT = z.infer<typeof ParsedBillOk>;
export type ProposedJournalEntryT = z.infer<typeof ProposedJournalEntry>;
