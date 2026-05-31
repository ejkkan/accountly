import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { describe, it, expect } from "vitest";
import { parseBill, type ParseBillEnv } from "../src/lib/parse-bill";
import { validateProposal } from "../src/lib/validate-proposal";
import type { ParsedBill } from "../src/lib/journal-schema";
import { scenarios, type Expected } from "./scenarios";

// The eval calls the REAL model, so it's opt-in: it loads ANTHROPIC_API_KEY
// from .dev.vars (same as the migrate script) and skips entirely if it's
// absent. Run with `pnpm --filter @accountly/backend test:evals`.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load the agent's key from .dev.vars (same pattern as scripts/migrate.ts).
loadDotenv({ path: path.join(__dirname, "..", ".dev.vars") });
const apiKey = process.env.ANTHROPIC_API_KEY;
const env: ParseBillEnv = { ANTHROPIC_API_KEY: apiKey ?? "" };

function assertOutcome(out: ParsedBill, expected: Expected): void {
  if (expected.outcome === "reject") {
    expect(out.kind, "expected the agent to reject this document").toBe("not_an_invoice");
    return;
  }

  expect(out.kind, "expected the agent to propose an entry").toBe("ok");
  if (out.kind !== "ok") return;

  // Every proposal must pass the same accounting gate the route enforces.
  const validation = validateProposal(out.proposal);
  expect(validation.errors).toEqual([]);

  const postings = out.proposal.postings;
  const codes = postings.map((p) => p.accountCode);
  for (const c of expected.mustInclude ?? []) expect(codes, `must post to ${c}`).toContain(c);
  for (const c of expected.mustExclude ?? [])
    expect(codes, `must not post to ${c}`).not.toContain(c);
  for (const c of expected.debit ?? []) {
    expect(
      postings.some((p) => p.accountCode === c && p.debitMinor > 0),
      `${c} must be debited`
    ).toBe(true);
  }
  for (const c of expected.credit ?? []) {
    expect(
      postings.some((p) => p.accountCode === c && p.creditMinor > 0),
      `${c} must be credited`
    ).toBe(true);
  }
}

describe.skipIf(!apiKey)("agent scenario regression suite", () => {
  it.each(scenarios)("$id — $description", async (scenario) => {
    const bytes = await scenario.fixture();
    const out = await parseBill(env, bytes);
    assertOutcome(out, scenario.expected);
  });
});
