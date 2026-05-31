import { sql, type Transaction } from "kysely";
import type { Database } from "../db";

/**
 * Supplier resolution: turn the per-invoice extracted vendor fields into a
 * canonical `supplier` row, reusing an existing record when the identifiers
 * match instead of creating a duplicate.
 *
 * The matching + normalization rules are the interesting part, so they're
 * pure functions (unit-tested in suppliers.test.ts). `findOrCreateSupplier`
 * just wires those rules to the DB inside the caller's transaction.
 */

export interface SupplierInput {
  name: string | null;
  orgNumber: string | null;
  vatNumber: string | null;
}

export interface NormalizedSupplier {
  name: string;
  orgNumber: string | null;
  vatNumber: string | null;
}

/** Swedish org.nr → canonical "NNNNNN-NNNN". Left as-is if it isn't 10 digits. */
export function normalizeOrgNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** VAT number → uppercase, spaces stripped (e.g. "se 5598…01" → "SE5598…01"). */
export function normalizeVatNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.replace(/\s+/g, "").toUpperCase();
  return v.length > 0 ? v : null;
}

/** Normalize the extracted fields, or null when there's no usable name. */
export function normalizeSupplier(input: SupplierInput): NormalizedSupplier | null {
  const name = input.name?.trim();
  if (!name) return null; // no name → nothing to anchor a supplier on
  return {
    name,
    orgNumber: normalizeOrgNumber(input.orgNumber),
    vatNumber: normalizeVatNumber(input.vatNumber),
  };
}

/**
 * Enrich an existing supplier with identifiers we now have but it lacked —
 * backfill only. We never overwrite a non-null org.nr / VAT, so a bad parse
 * can't clobber a known-good identifier (a conflicting value would just match
 * a different supplier, or create a new one, via the unique index).
 */
export function enrichPatch(
  existing: { orgNumber: string | null; vatNumber: string | null },
  incoming: { orgNumber: string | null; vatNumber: string | null }
): { orgNumber?: string; vatNumber?: string } {
  const patch: { orgNumber?: string; vatNumber?: string } = {};
  if (incoming.orgNumber && !existing.orgNumber) patch.orgNumber = incoming.orgNumber;
  if (incoming.vatNumber && !existing.vatNumber) patch.vatNumber = incoming.vatNumber;
  return patch;
}

type Trx = Transaction<Database>;

/**
 * Find a matching supplier in this org (org.nr → VAT → case-insensitive name)
 * or create one. Returns the supplier id, or null when the parse had no
 * supplier name (the bill is then stored unlinked). Runs inside the caller's
 * transaction so it commits atomically with the bill.
 *
 * Note: under truly concurrent uploads of the same brand-new supplier the
 * partial-unique index could reject the second insert; for this app's scale a
 * retry isn't worth the complexity, so it's left as a known edge.
 */
export async function findOrCreateSupplier(
  trx: Trx,
  organizationId: string,
  input: SupplierInput
): Promise<string | null> {
  const normalized = normalizeSupplier(input);
  if (!normalized) return null;
  const { name, orgNumber, vatNumber } = normalized;

  const base = () =>
    trx
      .selectFrom("supplier")
      .select(["id", "orgNumber", "vatNumber"])
      .where("organizationId", "=", organizationId);

  let existing = orgNumber
    ? await base().where("orgNumber", "=", orgNumber).executeTakeFirst()
    : undefined;
  if (!existing && vatNumber) {
    existing = await base().where("vatNumber", "=", vatNumber).executeTakeFirst();
  }
  if (!existing) {
    existing = await base()
      .where(sql<boolean>`lower("name") = lower(${name})`)
      .executeTakeFirst();
  }

  if (existing) {
    const patch = enrichPatch(existing, { orgNumber, vatNumber });
    if (Object.keys(patch).length > 0) {
      await trx
        .updateTable("supplier")
        .set({ ...patch, updatedAt: sql`now()` })
        .where("id", "=", existing.id)
        .execute();
    }
    return existing.id;
  }

  const supplierId = crypto.randomUUID();
  await trx
    .insertInto("supplier")
    .values({ id: supplierId, organizationId, name, orgNumber, vatNumber })
    .execute();
  return supplierId;
}
