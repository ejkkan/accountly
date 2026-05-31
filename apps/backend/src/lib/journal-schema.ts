import { z } from "zod";
import { ALLOWED_ACCOUNT_CODES } from "./coa";

/**
 * What the LLM returns in one round-trip. Output is a discriminated union:
 *
 *   { kind: "ok", extracted, proposal }
 *     The PDF was a supplier invoice; both halves are valid.
 *
 *   { kind: "not_an_invoice", reason, detail }
 *     The PDF wasn't usable — it's a contract, a brochure, a receipt, an
 *     unreadable scan, or the currency isn't one we handle. `detail` is a
 *     single sentence the accountant sees verbatim.
 *
 * Letting the model classify and reject explicitly beats two alternatives:
 *   1. Forcing extraction even when the doc isn't an invoice → hallucinated
 *      line items and account mappings that look reasonable but are wrong.
 *   2. Catching Zod refinement errors after the fact → opaque messages like
 *      "Required field missing" with no path to a useful UI.
 *
 * All money is integer minor units (öre / cents) — the prompt is explicit
 * about this so the model doesn't return floats. The refinements below
 * re-validate.
 */

const MoneyMinor = z
  .number()
  .int("Must be integer minor units (öre)")
  .nonnegative("Money cannot be negative");

const ExtractedLineItem = z.object({
  lineNo: z.number().int().min(1),
  description: z.string().min(1),
  quantity: z.number().nullable(),
  unitPriceMinor: MoneyMinor.nullable(),
  amountMinor: MoneyMinor,
});

const ExtractedBill = z.object({
  supplierName: z.string().nullable(),
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
 * Posting: either a debit or a credit, never both, never neither.
 * Refinement enforces XOR; the entry-level refinement enforces balance.
 */
const ProposedPosting = z
  .object({
    lineNo: z.number().int().min(1),
    accountCode: z.string(),
    accountName: z.string(),
    debitMinor: MoneyMinor,
    creditMinor: MoneyMinor,
  })
  .refine(
    (p) => p.debitMinor > 0 !== p.creditMinor > 0,
    "Posting must move money exactly one direction (XOR debit/credit)"
  )
  .refine((p) => ALLOWED_ACCOUNT_CODES.has(p.accountCode), {
    message: "Unknown account code (not in chart of accounts)",
  });

const ProposedJournalEntry = z
  .object({
    reasoning: z.string().min(1, "Reasoning required").max(2000, "Keep reasoning under 2000 chars"),
    postings: z.array(ProposedPosting).min(2, "At least two postings"),
  })
  .refine((j) => {
    const debit = j.postings.reduce((sum, p) => sum + p.debitMinor, 0);
    const credit = j.postings.reduce((sum, p) => sum + p.creditMinor, 0);
    return debit === credit;
  }, "Total debits must equal total credits");

/** The success branch of the discriminated union. */
const ParsedBillOk = z.object({
  kind: z.literal("ok"),
  extracted: ExtractedBill,
  proposal: ProposedJournalEntry,
});

/**
 * The failure branch. `reason` is enum-narrowed so the frontend can branch
 * on it without parsing strings; `detail` is freeform prose the model
 * writes in second person to the accountant.
 */
export const PARSE_FAILURE_REASONS = [
  "not_an_invoice",
  "unreadable",
  "wrong_currency",
  "missing_data",
  "other",
] as const;

const ParsedBillFailed = z.object({
  kind: z.literal("not_an_invoice"),
  reason: z.enum(PARSE_FAILURE_REASONS),
  detail: z.string().min(1, "Need a sentence the accountant can read").max(500),
});

export const ParsedBillSchema = z.discriminatedUnion("kind", [ParsedBillOk, ParsedBillFailed]);

export type ParsedBill = z.infer<typeof ParsedBillSchema>;
export type ParsedBillOkT = z.infer<typeof ParsedBillOk>;
export type ParsedBillFailedT = z.infer<typeof ParsedBillFailed>;
export type ExtractedBillT = z.infer<typeof ExtractedBill>;
export type ExtractedLineItemT = z.infer<typeof ExtractedLineItem>;
export type ProposedJournalEntryT = z.infer<typeof ProposedJournalEntry>;
export type ProposedPostingT = z.infer<typeof ProposedPosting>;
