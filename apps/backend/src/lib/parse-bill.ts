import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { ParsedBillSchema, type ParsedBill } from "./journal-schema";
import { PROMPT_CHART_OF_ACCOUNTS, FALLBACK_ACCOUNT, ALLOWED_ACCOUNT_CODES } from "./coa";

/**
 * Default Claude model for invoice parsing. Sonnet 4.6 is the latest stable
 * Sonnet we know about and a good balance for structured-output extraction.
 * If a newer Sonnet ships, swap the constant.
 */
const PARSE_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a senior Swedish accountant translating supplier invoices into BAS kontoplan journal entries.

Hard rules:
- Return ALL monetary amounts as integer minor units (öre). 116 875,00 SEK = 11687500.
- Dates as ISO YYYY-MM-DD.
- Use accounts from the chart below — never invent codes.
- Decide whether to split VAT yourself based on the invoice. If a VAT amount is shown (e.g. "Moms 25%"), it almost always goes to 2640 (Ingående moms) as a debit.
- For a supplier bill not yet paid, credit 2440 (Leverantörsskulder) for the gross total.
- Debit the expense accounts that best match each line. Cleaning across periods is fine — one debit per line is acceptable.
- TOTAL DEBITS MUST EQUAL TOTAL CREDITS. This is not negotiable.

Chart of accounts (code + name):
${PROMPT_CHART_OF_ACCOUNTS}

Output JSON matching the requested schema. Provide a short "reasoning" paragraph (one or two sentences) explaining the account choices.`;

const USER_PROMPT = `Parse this invoice into:
1) An "extracted" object capturing the supplier, invoice number, dates, currency, line items, and totals.
2) A balanced "proposal" journal entry with postings and a short reasoning paragraph.`;

export interface ParseBillEnv {
  ANTHROPIC_API_KEY: string;
}

/**
 * Single round-trip. PDF goes to Claude as a `file` content part — no
 * pre-extraction step. `generateObject` enforces the Zod schema and runs
 * the entry-level balance refinement before returning.
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

  return normaliseAccountCodes(object);
}

/**
 * Belt-and-braces: in the unlikely event the model returned a posting with
 * a code outside the chart (the schema refinement would already have
 * thrown), fall back to 4010. The schema enforces codes are valid, so this
 * is effectively dead code on the happy path — kept for the harder PDF
 * the live interview will throw at us.
 */
function normaliseAccountCodes(parsed: ParsedBill): ParsedBill {
  return {
    ...parsed,
    proposal: {
      ...parsed.proposal,
      postings: parsed.proposal.postings.map((p) =>
        ALLOWED_ACCOUNT_CODES.has(p.accountCode)
          ? p
          : { ...p, accountCode: FALLBACK_ACCOUNT.code, accountName: FALLBACK_ACCOUNT.name }
      ),
    },
  };
}
