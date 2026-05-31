import { makeInvoicePdf, makeTextPdf, readSimpleInvoice } from "./fixtures";

/**
 * The golden-scenario corpus. Each scenario is one invoice (fixture) + the
 * outcome we expect the agent to produce. The eval runs the real agent over
 * every scenario; adding support for a new invoice shape = add a row here,
 * and the existing rows guard against regressions.
 *
 * Assertions target STABLE properties (the outcome, which accounts appear,
 * which side they land on) — not exact reasoning text — so temperature-0
 * runs are reliable rather than flaky.
 */
export type Expected =
  | {
      outcome: "propose";
      /** Account codes that must appear among the postings. */
      mustInclude?: string[];
      /** Account codes that must NOT appear (e.g. 2640 for an exempt invoice). */
      mustExclude?: string[];
      /** Codes that must carry a debit (> 0). */
      debit?: string[];
      /** Codes that must carry a credit (> 0). */
      credit?: string[];
    }
  | { outcome: "reject" };

export interface Scenario {
  id: string;
  description: string;
  fixture: () => Promise<Uint8Array>;
  expected: Expected;
}

export const scenarios: Scenario[] = [
  {
    id: "happy-standard",
    description:
      "the provided sample invoice → a balanced entry that credits 2440 (Leverantörsskulder)",
    fixture: readSimpleInvoice,
    // We don't author this PDF, so we assert only what's universally true for
    // a supplier bill: it balances and credits 2440. VAT and account-mapping
    // rules are checked on the generated fixtures below, where we control the
    // exact inputs and the answer is unambiguous.
    expected: { outcome: "propose", credit: ["2440"] },
  },
  {
    id: "vat-exempt",
    description: "a 0% (momsfri) invoice → no 2640 (ingående moms) posting",
    fixture: () =>
      makeInvoicePdf({
        title: "Faktura",
        supplier: "Trygg Försäkring AB",
        invoiceNumber: "INV-2024-114",
        date: "2024-03-02",
        currency: "SEK",
        lines: [{ description: "Företagsförsäkring helår (momsfri)", amount: 12000 }],
        vatRate: 0,
      }),
    expected: { outcome: "propose", mustExclude: ["2640"], credit: ["2440"] },
  },
  {
    id: "credit-note",
    description: "a kreditfaktura → flipped directions: 2440 is debited, not credited",
    fixture: () =>
      makeInvoicePdf({
        title: "Kreditfaktura",
        supplier: "Telia Sverige AB",
        invoiceNumber: "KF-5567",
        date: "2024-03-10",
        currency: "SEK",
        lines: [{ description: "Kreditering datakommunikation", amount: -4000 }],
        vatRate: 25,
      }),
    expected: { outcome: "propose", debit: ["2440"] },
  },
  {
    id: "account-mapping",
    description: "a rent invoice → expense mapped to 5010 (Lokalhyra), VAT to 2640, gross to 2440",
    fixture: () =>
      makeInvoicePdf({
        title: "Faktura",
        supplier: "Fastighets AB Kontoret",
        invoiceNumber: "INV-7788",
        date: "2024-03-04",
        currency: "SEK",
        lines: [{ description: "Lokalhyra kontorslokal mars 2024", amount: 18000 }],
        vatRate: 25,
      }),
    expected: { outcome: "propose", mustInclude: ["5010"], credit: ["2440"], debit: ["2640"] },
  },
  {
    id: "reject-non-invoice",
    description: "meeting notes, not an invoice → reject_document",
    fixture: () =>
      makeTextPdf([
        "Meeting notes — Q1 planning",
        "",
        "Attendees: Anna, Erik, Sofia",
        "- Review the spring roadmap",
        "- Decide on the hiring plan",
        "- Next sync: Friday 10:00",
      ]),
    expected: { outcome: "reject" },
  },
];
