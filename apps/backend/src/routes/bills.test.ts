import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Env } from "../index";
import type { ParsedBill } from "../lib/journal-schema";

// These tests exercise the route's OWN logic — input validation and the
// reject / invalid-proposal branches that 422 before any persistence — not
// better-auth or the DB. So we bypass the session middleware and stub the
// model; no scenario here reaches R2 or Postgres.
vi.mock("../middleware/auth", () => ({
  requireSession:
    () => async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
      c.set("db", {});
      c.set("userId", "u1");
      c.set("organizationId", "org1");
      await next();
    },
}));
vi.mock("../lib/parse-bill", () => ({ parseBill: vi.fn() }));

import handler from "../index";
import { parseBill } from "../lib/parse-bill";

const mockParse = vi.mocked(parseBill);
const env = {} as unknown as Env;

beforeEach(() => mockParse.mockReset());

function post(form: FormData): Promise<Response> {
  return handler.fetch(
    new Request("http://localhost/api/bills", { method: "POST", body: form }),
    env
  ) as Promise<Response>;
}

function pdf(bytes: Uint8Array, name = "invoice.pdf"): File {
  return new File([bytes], name, { type: "application/pdf" });
}

async function errorCode(res: Response): Promise<string | undefined> {
  return ((await res.json()) as { error?: { code?: string } }).error?.code;
}

describe("POST /api/bills", () => {
  it("400s when no file is attached", async () => {
    const res = await post(new FormData());
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("missing_file");
  });

  it("400s when the file isn't a PDF", async () => {
    const form = new FormData();
    form.append("file", new File(["notes"], "notes.txt", { type: "text/plain" }));
    const res = await post(form);
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("not_pdf");
  });

  it("400s when the PDF exceeds the size limit", async () => {
    const form = new FormData();
    form.append("file", pdf(new Uint8Array(10 * 1024 * 1024 + 1), "big.pdf"));
    const res = await post(form);
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("too_large");
    expect(mockParse).not.toHaveBeenCalled();
  });

  it("422s (and persists nothing) when the model rejects the document", async () => {
    mockParse.mockResolvedValue({ kind: "not_an_invoice", detail: "This is a receipt." });
    const form = new FormData();
    form.append("file", pdf(new Uint8Array([1, 2, 3])));
    const res = await post(form);
    expect(res.status).toBe(422);
    expect(await errorCode(res)).toBe("not_an_invoice");
  });

  it("422s when the proposed entry doesn't balance", async () => {
    mockParse.mockResolvedValue({
      kind: "ok",
      extracted: { lineItems: [] },
      proposal: {
        reasoning: "unbalanced on purpose",
        postings: [
          { lineNo: 1, accountCode: "4010", debitMinor: 8000, creditMinor: 0 },
          { lineNo: 2, accountCode: "2440", debitMinor: 0, creditMinor: 9000 },
        ],
      },
    } as unknown as ParsedBill);
    const form = new FormData();
    form.append("file", pdf(new Uint8Array([1, 2, 3])));
    const res = await post(form);
    expect(res.status).toBe(422);
    expect(await errorCode(res)).toBe("invalid_proposal");
  });
});
