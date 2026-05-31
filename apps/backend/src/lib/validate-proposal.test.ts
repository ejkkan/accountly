import { describe, it, expect } from "vitest";
import { validateProposal } from "./validate-proposal";
import type { ProposedJournalEntryT } from "./journal-schema";

type Posting = ProposedJournalEntryT["postings"][number];

function entry(postings: Posting[]): ProposedJournalEntryT {
  return { reasoning: "test rationale", postings };
}

// A normal unpaid supplier bill: net to an expense account, VAT to 2640,
// gross credited to 2440 — balanced.
const BALANCED: Posting[] = [
  { lineNo: 1, accountCode: "4010", debitMinor: 8000, creditMinor: 0 },
  { lineNo: 2, accountCode: "2640", debitMinor: 2000, creditMinor: 0 },
  { lineNo: 3, accountCode: "2440", debitMinor: 0, creditMinor: 10000 },
];

describe("validateProposal", () => {
  it("accepts a balanced, single-direction, known-account entry", () => {
    const r = validateProposal(entry(BALANCED));
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("rejects an unbalanced entry", () => {
    const r = validateProposal(
      entry([
        { lineNo: 1, accountCode: "4010", debitMinor: 8000, creditMinor: 0 },
        { lineNo: 2, accountCode: "2440", debitMinor: 0, creditMinor: 9000 },
      ])
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /balance/i.test(e))).toBe(true);
  });

  it("rejects a posting that moves money in both directions", () => {
    const r = validateProposal(
      entry([
        { lineNo: 1, accountCode: "4010", debitMinor: 5000, creditMinor: 5000 },
        { lineNo: 2, accountCode: "2440", debitMinor: 0, creditMinor: 5000 },
      ])
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /one direction/i.test(e))).toBe(true);
  });

  it("rejects an account code outside the chart", () => {
    const r = validateProposal(
      entry([
        { lineNo: 1, accountCode: "9999", debitMinor: 10000, creditMinor: 0 },
        { lineNo: 2, accountCode: "2440", debitMinor: 0, creditMinor: 10000 },
      ])
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /chart of accounts/i.test(e))).toBe(true);
  });

  it("rejects fewer than two postings", () => {
    const r = validateProposal(
      entry([{ lineNo: 1, accountCode: "4010", debitMinor: 10000, creditMinor: 0 }])
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /two postings/i.test(e))).toBe(true);
  });
});
