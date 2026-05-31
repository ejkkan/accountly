/**
 * Debug inspector: run the parse agent on any PDF and print everything it
 * produced — extraction, the proposed journal entry, the balance/validation
 * result, and the model's reasoning.
 *
 *   pnpm --filter @accountly/backend parse path/to/invoice.pdf
 *
 * The tight loop for a new/harder invoice: run this → read the output →
 * tweak the prompt in lib/parse-bill.ts → re-run → then `pnpm test:evals`
 * to confirm the known scenarios still pass before locking the new one in.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { parseBill } from "../src/lib/parse-bill";
import { validateProposal } from "../src/lib/validate-proposal";
import { accountName } from "../src/lib/coa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(__dirname, "..", ".dev.vars") });

/** Integer öre → "1234.50" (or "—" for null). */
function kr(minor: number | null | undefined): string {
  return minor == null ? "—" : (minor / 100).toFixed(2);
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: pnpm --filter @accountly/backend parse <path-to.pdf>");
    process.exit(1);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set — add it to apps/backend/.dev.vars");
    process.exit(1);
  }

  const bytes = new Uint8Array(await fs.readFile(path.resolve(file)));
  console.log(`Parsing ${file} (${bytes.byteLength} bytes)…\n`);

  const started = Date.now();
  const parsed = await parseBill({ ANTHROPIC_API_KEY: apiKey }, bytes);
  const ms = Date.now() - started;

  if (parsed.kind === "not_an_invoice") {
    console.log(`REJECTED (${ms}ms)`);
    console.log(`  detail: ${parsed.detail}`);
    return;
  }

  const { extracted, proposal } = parsed;
  console.log(`PROPOSED (${ms}ms)\n`);
  console.log("Extracted");
  console.log(`  supplier : ${extracted.supplierName ?? "—"}`);
  console.log(`  invoice #: ${extracted.invoiceNumber ?? "—"}`);
  console.log(`  date     : ${extracted.invoiceDate ?? "—"}   due: ${extracted.dueDate ?? "—"}`);
  console.log(`  currency : ${extracted.currency}`);
  console.log(
    `  subtotal : ${kr(extracted.subtotalMinor)}   vat: ${kr(extracted.vatMinor)}   total: ${kr(extracted.totalMinor)}`
  );
  console.log(`  lines    : ${extracted.lineItems.length}`);
  for (const li of extracted.lineItems) {
    console.log(`    ${li.lineNo}. ${li.description} — ${kr(li.amountMinor)}`);
  }

  console.log("\nProposed journal entry");
  for (const p of proposal.postings) {
    console.log(
      `  ${p.accountCode}  ${accountName(p.accountCode).padEnd(28)}  debit ${kr(p.debitMinor).padStart(12)}   credit ${kr(p.creditMinor).padStart(12)}`
    );
  }

  const v = validateProposal(proposal);
  console.log(`\nValidation: ${v.ok ? "balanced & valid" : "INVALID — " + v.errors.join("; ")}`);
  console.log(`\nReasoning: ${proposal.reasoning}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
