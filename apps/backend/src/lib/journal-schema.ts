import { z } from "zod";
import { ALLOWED_ACCOUNT_CODES } from "./coa";

/**
 * What the LLM is asked to return in one round-trip. Two halves:
 *
 *   1. `extracted` — the invoice header + line items as faithfully as
 *      possible, used to populate the bill row.
 *   2. `proposal`  — the journal entry: balanced postings + a short rationale.
 *
 * All money is integer minor units (öre / cents) — the prompt is explicit
 * about this so the model doesn't return floats. We re-validate with the
 * refinements below.
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
    (p) => (p.debitMinor > 0) !== (p.creditMinor > 0),
    "Posting must move money exactly one direction (XOR debit/credit)"
  )
  // Reject account codes outside the CoA. The fallback to 4010 happens
  // upstream — by the time we validate, every code should be allowed.
  .refine(
    (p) => ALLOWED_ACCOUNT_CODES.has(p.accountCode),
    { message: "Unknown account code (not in chart of accounts)" }
  );

const ProposedJournalEntry = z
  .object({
    reasoning: z
      .string()
      .min(1, "Reasoning required")
      .max(2000, "Keep reasoning under 2000 chars"),
    postings: z.array(ProposedPosting).min(2, "At least two postings"),
  })
  .refine((j) => {
    const debit = j.postings.reduce((sum, p) => sum + p.debitMinor, 0);
    const credit = j.postings.reduce((sum, p) => sum + p.creditMinor, 0);
    return debit === credit;
  }, "Total debits must equal total credits");

export const ParsedBillSchema = z.object({
  extracted: ExtractedBill,
  proposal: ProposedJournalEntry,
});

export type ParsedBill = z.infer<typeof ParsedBillSchema>;
export type ExtractedBillT = z.infer<typeof ExtractedBill>;
export type ExtractedLineItemT = z.infer<typeof ExtractedLineItem>;
export type ProposedJournalEntryT = z.infer<typeof ProposedJournalEntry>;
export type ProposedPostingT = z.infer<typeof ProposedPosting>;
