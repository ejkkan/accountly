import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { ParsedBillSchema, type ParsedBill, type ParsedBillOkT } from "./journal-schema";
import { PROMPT_CHART_OF_ACCOUNTS, FALLBACK_ACCOUNT, ALLOWED_ACCOUNT_CODES } from "./coa";

/**
 * Default Claude model for invoice parsing. Sonnet 4.6 is the latest stable
 * Sonnet we know about and a good balance for structured-output extraction.
 * If a newer Sonnet ships, swap the constant.
 */
const PARSE_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a senior Swedish accountant turning supplier invoices into BAS kontoplan journal entries.

Output schema is a DISCRIMINATED UNION. Pick the right "kind":

  { "kind": "ok", "extracted": {...}, "proposal": {...} }
    Use ONLY when the PDF is clearly a supplier invoice you can extract
    AND map to balanced BAS postings.

  { "kind": "not_an_invoice", "reason": <enum>, "detail": "<one sentence>" }
    Use when:
      - the document isn't a supplier invoice (receipt, contract, brochure, etc.)
      - it's too unclear / blurry / cropped to read
      - the currency isn't SEK (we only handle SEK for now)
      - critical fields (supplier, total, or line items) are missing
    Pick the most specific "reason" enum value. "detail" goes straight into
    a toast the accountant sees — write it as if speaking to them, one
    sentence, no preamble.

When you return "ok":
- All monetary amounts as INTEGER minor units (öre). 116 875,00 SEK = 11687500.
- Dates as ISO YYYY-MM-DD.
- Use accounts from the chart below — NEVER invent codes.
- Split VAT yourself based on the invoice. If a VAT amount is shown
  (e.g. "Moms 25%"), debit 2640 (Ingående moms) for it.
- For a supplier bill not yet paid, credit 2440 (Leverantörsskulder) for
  the gross total.
- Debit the expense accounts that best match each line.
- TOTAL DEBITS MUST EQUAL TOTAL CREDITS. Non-negotiable.

Chart of accounts (code + name):
${PROMPT_CHART_OF_ACCOUNTS}

Provide a short "reasoning" paragraph (one or two sentences) explaining the
account choices.`;

const USER_PROMPT = `Classify and parse this PDF. If it's a Swedish supplier invoice, return
{ kind: "ok", extracted, proposal }. If it isn't, return
{ kind: "not_an_invoice", reason, detail }.`;

export interface ParseBillEnv {
  ANTHROPIC_API_KEY: string;
}

/**
 * Single round-trip. PDF goes to Claude as a `file` content part — no
 * pre-extraction step. `generateObject` enforces the Zod discriminated
 * union; either we get a clean "ok" payload or a structured rejection.
 */
export async function parseBill(env: ParseBillEnv, pdfBytes: Uint8Array): Promise<ParsedBill> {
  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const { object } = await generateObject({
    model: anthropic(PARSE_MODEL),
    schema: ParsedBillSchema,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: USER_PROMPT },
          {
            type: "file",
            data: pdfBytes,
            mediaType: "application/pdf",
          },
        ],
      },
    ],
  });

  // The success branch may have account codes from a model slip; the schema
  // refinement already rejects unknown codes (so this is effectively dead
  // code), but kept as defence in depth for the harder PDF the live
  // interview will throw at us.
  if (object.kind === "ok") {
    return normaliseAccountCodes(object);
  }
  return object;
}

function normaliseAccountCodes(parsed: ParsedBillOkT): ParsedBillOkT {
  return {
    ...parsed,
    proposal: {
      ...parsed.proposal,
      postings: parsed.proposal.postings.map((p) =>
        ALLOWED_ACCOUNT_CODES.has(p.accountCode)
          ? p
          : {
              ...p,
              accountCode: FALLBACK_ACCOUNT.code,
              accountName: FALLBACK_ACCOUNT.name,
            }
      ),
    },
  };
}
