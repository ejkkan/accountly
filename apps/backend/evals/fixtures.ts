import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Eval fixtures. The canonical happy case is the real `simple_invoice.pdf`
 * the assignment ships; the edge cases are generated from declarative data
 * with pdf-lib. Generating (vs. committing binary blobs) keeps each
 * fixture's content explicit and reviewable in the repo, and lets the
 * scenario assertions target exact values we authored.
 *
 * The model reads PDFs as vision, and a pdf-lib text page renders as a
 * perfectly readable invoice.
 */

/** Render a single-page A4 PDF from plain text lines. */
export async function makeTextPdf(lines: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let y = 800;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 12, font, color: rgb(0, 0, 0) });
    y -= 22;
  }
  return doc.save();
}

export interface InvoiceSpec {
  title?: string;
  supplier: string;
  invoiceNumber: string;
  date: string; // YYYY-MM-DD
  currency: string;
  /** Line items in MAJOR units (kr). Negative for a credit note. */
  lines: { description: string; amount: number }[];
  /** VAT rate as a percent: 25 / 12 / 6 / 0. */
  vatRate: number;
}

function money(n: number, currency: string): string {
  return `${n.toFixed(2)} ${currency}`;
}

/** Build an invoice PDF from a spec. net = Σ lines; vat = net × rate%; total = net + vat. */
export async function makeInvoicePdf(spec: InvoiceSpec): Promise<Uint8Array> {
  const net = spec.lines.reduce((sum, l) => sum + l.amount, 0);
  const vat = Math.round(net * spec.vatRate) / 100;
  const total = net + vat;
  return makeTextPdf([
    spec.title ?? "Faktura / Invoice",
    "",
    `Supplier: ${spec.supplier}`,
    `Invoice number: ${spec.invoiceNumber}`,
    `Invoice date: ${spec.date}`,
    `Currency: ${spec.currency}`,
    "",
    "Line items:",
    ...spec.lines.map((l, i) => `  ${i + 1}. ${l.description} — ${money(l.amount, spec.currency)}`),
    "",
    `Subtotal (net): ${money(net, spec.currency)}`,
    `VAT ${spec.vatRate}%: ${money(vat, spec.currency)}`,
    `Total: ${money(total, spec.currency)}`,
  ]);
}

/**
 * Read a PDF fixture by path relative to the repo root — e.g. a file you
 * dropped into `apps/backend/evals/fixtures/`, or one of the provided
 * `assignment/` PDFs. Adding a real-PDF scenario is then a one-liner:
 * `fixture: () => readPdf("apps/backend/evals/fixtures/harder.pdf")`.
 */
export async function readPdf(repoRelativePath: string): Promise<Uint8Array> {
  return new Uint8Array(await fs.readFile(path.join(__dirname, "../../..", repoRelativePath)));
}

/** The real sample invoice the assignment provides. */
export function readSimpleInvoice(): Promise<Uint8Array> {
  return readPdf("assignment/simple_invoice.pdf");
}
