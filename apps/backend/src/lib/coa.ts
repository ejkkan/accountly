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
 * Markdown-ish table of accounts dropped straight into the LLM prompt.
 * Pre-rendered so we don't rebuild it every request.
 */
export const PROMPT_CHART_OF_ACCOUNTS = CHART_OF_ACCOUNTS.map((a) => `${a.code}  ${a.name}`).join(
  "\n"
);

/** All allowed codes — used by validateProposal (lib/validate-proposal.ts). */
export const ALLOWED_ACCOUNT_CODES = new Set<string>(CHART_OF_ACCOUNTS.map((a) => a.code));

const ACCOUNT_NAME_BY_CODE = new Map<string, string>(
  CHART_OF_ACCOUNTS.map((a) => [a.code, a.name])
);

/**
 * Canonical account name for a chart code. The proposal only carries the
 * account *code* (the model's decision); the displayed name is derived here
 * so a code can never be persisted/shown with the wrong label. Codes are
 * chart-validated before persisting, so the lookup is always present — the
 * fallback to the code is purely defensive.
 */
export function accountName(code: string): string {
  return ACCOUNT_NAME_BY_CODE.get(code) ?? code;
}
