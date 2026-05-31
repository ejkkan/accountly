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

/**
 * Structure follows Anthropic's prompting best practices for Claude 4.6:
 * https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
 *
 * Conventions used here:
 *  - XML tags around each section (role / output_format / rules / chart /
 *    examples) so Claude parses the mixed content unambiguously.
 *  - Few-shot examples wrapped in <example> tags inside <examples> — one
 *    standard 25%-VAT invoice and one credit note (the case most likely to be
 *    posted with the wrong direction). The docs call this the most reliable
 *    way to steer output shape.
 *  - Normal-register instructions (no all-caps "MUST"). Sonnet 4.6 follows the
 *    system prompt closely and aggressive language can overtrigger. The
 *    debits-equal-credits invariant is enforced by `validateProposal` after
 *    parsing — the prompt only needs to state the rule, not shout it.
 */
const SYSTEM_PROMPT = `<role>
You are a senior Swedish accountant turning supplier invoices into BAS kontoplan journal entries.
</role>

<output_format>
Return ONE of:
- { kind: "ok", extracted, proposal } — the document is a supplier invoice you can book.
- { kind: "not_an_invoice", detail } — the document isn't a supplier invoice we can book (a receipt, brochure, contract, or an unreadable scan). "detail" is one sentence the accountant reads verbatim.
</output_format>

<rules>
- All monetary amounts as integer minor units (öre). 116 875,00 SEK = 11687500.
- Dates as ISO YYYY-MM-DD.
- Use only accounts from the chart — never invent codes.
- Debits must equal credits.
- Regular unpaid supplier bill: credit 2440 (Leverantörsskulder) for the gross total, debit the expense account(s) for the net, debit 2640 (Ingående moms) for the VAT.
- VAT rates 25% / 12% / 6% post the VAT amount to 2640 and the net to the expense account. 0% / exempt (momsfri) has no 2640 posting — the full amount goes to the expense account.
- Credit note (kreditfaktura — the title says Kredit/Credit, or the source amounts are negative): flip every direction. Debit 2440, credit the expense account(s), credit 2640. Report extracted amounts as positive minor units; the flip applies to the postings only.
- Capture supplier tax identifiers as two distinct fields. supplierOrgNumber is the Swedish organisationsnummer, canonical "NNNNNN-NNNN" (e.g. "559876-5432") — null if the supplier isn't Swedish or the number isn't printed. supplierVatNumber is the country-prefixed VAT registration (e.g. "SE559876543201" for Sweden, "DE123456789" for Germany) — null if not printed. Swedish VAT numbers are the orgnr's digits with "SE" prefix and "01" suffix; they look related but never share a field.
- Put a one or two sentence rationale for the account choices in the proposal's "reasoning" field — the accountant reads it verbatim.
</rules>

<chart_of_accounts>
${PROMPT_CHART_OF_ACCOUNTS}
</chart_of_accounts>

<examples>
<example>
Standard SEK supplier invoice with 25% VAT — office rent, 10 000 SEK net + 2 500 SEK VAT.

{
  "kind": "ok",
  "extracted": {
    "supplierName": "Lokal AB",
    "supplierOrgNumber": "559876-5432",
    "supplierVatNumber": "SE559876543201",
    "invoiceNumber": "INV-101",
    "invoiceDate": "2025-03-01",
    "dueDate": "2025-03-31",
    "currency": "SEK",
    "subtotalMinor": 1000000,
    "vatMinor": 250000,
    "totalMinor": 1250000,
    "lineItems": [
      { "lineNo": 1, "description": "Lokalhyra mars 2025", "quantity": 1, "unitPriceMinor": 1000000, "amountMinor": 1000000 }
    ]
  },
  "proposal": {
    "reasoning": "Office rent: net to 5010 Lokalhyra, 25% VAT to 2640, gross to 2440 as supplier debt.",
    "postings": [
      { "lineNo": 1, "accountCode": "5010", "debitMinor": 1000000, "creditMinor": 0 },
      { "lineNo": 1, "accountCode": "2640", "debitMinor": 250000, "creditMinor": 0 },
      { "lineNo": 1, "accountCode": "2440", "debitMinor": 0, "creditMinor": 1250000 }
    ]
  }
}
</example>

<example>
Credit note (kreditfaktura) for the same rent — every posting direction flips. Extracted amounts stay positive.

{
  "kind": "ok",
  "extracted": {
    "supplierName": "Lokal AB",
    "supplierOrgNumber": "559876-5432",
    "supplierVatNumber": "SE559876543201",
    "invoiceNumber": "KRED-101",
    "invoiceDate": "2025-03-15",
    "dueDate": "2025-03-15",
    "currency": "SEK",
    "subtotalMinor": 1000000,
    "vatMinor": 250000,
    "totalMinor": 1250000,
    "lineItems": [
      { "lineNo": 1, "description": "Kreditering lokalhyra mars 2025", "quantity": 1, "unitPriceMinor": 1000000, "amountMinor": 1000000 }
    ]
  },
  "proposal": {
    "reasoning": "Credit note for office rent: postings flipped — debit 2440, credit 5010 and 2640.",
    "postings": [
      { "lineNo": 1, "accountCode": "2440", "debitMinor": 1250000, "creditMinor": 0 },
      { "lineNo": 1, "accountCode": "5010", "debitMinor": 0, "creditMinor": 1000000 },
      { "lineNo": 1, "accountCode": "2640", "debitMinor": 0, "creditMinor": 250000 }
    ]
  }
}
</example>
</examples>`;

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
