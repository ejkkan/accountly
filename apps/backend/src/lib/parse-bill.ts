import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { ParsedBillSchema, type ParsedBill } from "./journal-schema";
import { PROMPT_CHART_OF_ACCOUNTS } from "./coa";

/**
 * The parse agent: one PDF in, one structured result out.
 *
 * `generateObject` forces the model to return JSON matching `ParsedBillSchema`
 * (a forced tool call under the hood) and validates the response against that
 * Zod schema — so a malformed reply throws instead of flowing through untyped.
 * The result is a typed discriminated union:
 *
 *   { kind: "ok", extracted, proposal }  — a bookable invoice
 *   { kind: "not_an_invoice", detail }    — not bookable; a reason for the accountant
 *
 * VAT and credit-note handling are accounting rules stated in the system
 * prompt. The balance / debit-XOR-credit / known-account rules are enforced
 * separately by `validateProposal` after parsing (the route's hard gate).
 *
 * temperature 0 → the same invoice yields the same entry, which is what the
 * scenario regression evals rely on.
 */

const PARSE_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a senior Swedish accountant turning supplier invoices into BAS kontoplan journal entries.

Return ONE of:
- { kind: "ok", extracted, proposal } — the document is a supplier invoice you can book.
- { kind: "not_an_invoice", detail } — the document isn't a supplier invoice we can
  book (a receipt, brochure, contract, or an unreadable scan). "detail" is one
  sentence the accountant reads verbatim.

Rules for a successful proposal:
- All monetary amounts as INTEGER minor units (öre). 116 875,00 SEK = 11687500.
- Dates as ISO YYYY-MM-DD.
- Use ONLY accounts from the chart below — never invent codes.
- TOTAL DEBITS MUST EQUAL TOTAL CREDITS.
- Regular unpaid supplier bill: credit 2440 (Leverantörsskulder) for the gross
  total, debit the expense account(s) for the net, debit 2640 (Ingående moms)
  for the VAT.
- VAT: rates 25% / 12% / 6% post the VAT amount to 2640 and the net to the
  expense account. 0% / exempt (momsfri) has no 2640 posting — the full amount
  goes to the expense account.
- Credit note (kreditfaktura — the title says Kredit/Credit, or the amounts are
  negative): flip every direction — debit 2440, credit the expense account(s),
  credit 2640.

Chart of accounts (code + name):
${PROMPT_CHART_OF_ACCOUNTS}

Put a one or two sentence rationale for the account choices in the proposal's
"reasoning" field — the accountant reads it verbatim.`;

const USER_PROMPT = `Parse this PDF following the system prompt and return the structured result.`;

export interface ParseBillEnv {
  ANTHROPIC_API_KEY: string;
}

/**
 * Run the model on the PDF bytes and return the validated, typed result. Pure:
 * no DB, no R2 — the caller (upload / reparse routes, the eval) decides what to
 * do with the outcome.
 */
export async function parseBill(env: ParseBillEnv, pdfBytes: Uint8Array): Promise<ParsedBill> {
  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const { object } = await generateObject({
    model: anthropic(PARSE_MODEL),
    temperature: 0,
    // Generous headroom so a long, many-line invoice can't truncate the
    // structured output mid-object (which would surface as a parse failure).
    maxOutputTokens: 8192,
    schema: ParsedBillSchema,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: USER_PROMPT },
          { type: "file", data: pdfBytes, mediaType: "application/pdf" },
        ],
      },
    ],
  });
  return object;
}
