/**
 * BAS kontoplan — exactly the 20 rows the assignment ships with. Frozen as
 * the source of truth so the LLM, the validator, and the UI all agree on
 * which codes exist.
 *
 * If we ever add an account here, also update:
 *  - the `promptCoa` block (it's a derived string, but cached)
 *  - any UI that shows account labels
 */
export const CHART_OF_ACCOUNTS = [
  { code: "1930", name: "Företagskonto" },
  { code: "2440", name: "Leverantörsskulder" },
  { code: "2640", name: "Ingående moms" },
  { code: "4010", name: "Inköp material & varor" },
  { code: "5010", name: "Lokalhyra" },
  { code: "5060", name: "Driftskostnader lokal" },
  { code: "5220", name: "Hyra inventarier" },
  { code: "5410", name: "Förbrukningsinventarier" },
  { code: "5460", name: "Förbrukningsmaterial" },
  { code: "5610", name: "Kontorsmaterial" },
  { code: "5690", name: "Övriga kontorskostnader" },
  { code: "6110", name: "Kontorsförnödenheter" },
  { code: "6211", name: "Fast telefoni" },
  { code: "6230", name: "Datakommunikation" },
  { code: "6310", name: "Företagsförsäkringar" },
  { code: "6530", name: "IT-tjänster" },
  { code: "6540", name: "IT-drift & hosting" },
  { code: "6570", name: "Programvara, licenser" },
  { code: "6910", name: "Licensavgifter & medlemskap" },
  { code: "7631", name: "Personalmat & fika" },
] as const;

export type AccountCode = (typeof CHART_OF_ACCOUNTS)[number]["code"];

/**
 * Safe lookup: returns null for unknown codes (e.g. if the model
 * hallucinates a code outside the table). Callers should map null → the
 * fallback account (4010 — Inköp material & varor) per the design
 * decision in phase 5.
 */
export function accountByCode(code: string): { code: string; name: string } | null {
  return CHART_OF_ACCOUNTS.find((a) => a.code === code) ?? null;
}

/** When Claude can't confidently map a line, this is what we use. */
export const FALLBACK_ACCOUNT = { code: "4010", name: "Inköp material & varor" } as const;

/**
 * Markdown-ish table of accounts dropped straight into the LLM prompt.
 * Pre-rendered so we don't rebuild it every request.
 */
export const PROMPT_CHART_OF_ACCOUNTS = CHART_OF_ACCOUNTS.map(
  (a) => `${a.code}  ${a.name}`
).join("\n");

/** All allowed codes — handy for the Zod refinement in journal-schema.ts. */
export const ALLOWED_ACCOUNT_CODES = new Set<string>(
  CHART_OF_ACCOUNTS.map((a) => a.code)
);
