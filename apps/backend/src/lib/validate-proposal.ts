import { ALLOWED_ACCOUNT_CODES } from "./coa";
import type { ProposedJournalEntryT } from "./journal-schema";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * The accounting rules for a proposed journal entry — checked in code,
 * independent of the prompt and the Zod shape, so they're unit-testable and
 * return specific errors. The route runs this as the authoritative gate
 * before persisting: an invalid proposal is rejected (422), never stored.
 *
 * All amounts are integer minor units (öre), so the sums are exact — no
 * float drift, no rounding. Each rule:
 *   - at least two postings (a debit and a credit side)
 *   - every posting moves money exactly one direction (debit XOR credit)
 *   - no negative amounts
 *   - every account code is in the BAS chart
 *   - total debits === total credits (double-entry balance)
 */
export function validateProposal(entry: ProposedJournalEntryT): ValidationResult {
  const errors: string[] = [];
  const { postings } = entry;

  if (postings.length < 2) {
    errors.push("A journal entry needs at least two postings.");
  }

  let debits = 0;
  let credits = 0;
  for (const p of postings) {
    const where = `Posting ${p.lineNo}`;
    if (p.debitMinor < 0 || p.creditMinor < 0) {
      errors.push(`${where}: amounts cannot be negative.`);
    }
    if (p.debitMinor > 0 === p.creditMinor > 0) {
      errors.push(`${where}: must move money exactly one direction (debit XOR credit).`);
    }
    if (!ALLOWED_ACCOUNT_CODES.has(p.accountCode)) {
      errors.push(`${where}: account ${p.accountCode} is not in the chart of accounts.`);
    }
    debits += p.debitMinor;
    credits += p.creditMinor;
  }

  if (debits !== credits) {
    errors.push(`Debits (${debits}) and credits (${credits}) must balance.`);
  }

  return { ok: errors.length === 0, errors };
}
