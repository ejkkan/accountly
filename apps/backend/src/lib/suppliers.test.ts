import { describe, it, expect } from "vitest";
import {
  normalizeOrgNumber,
  normalizeVatNumber,
  normalizeSupplier,
  enrichPatch,
} from "./suppliers";

describe("normalizeOrgNumber", () => {
  it("formats 10 digits as NNNNNN-NNNN", () => {
    expect(normalizeOrgNumber("5598765432")).toBe("559876-5432");
    expect(normalizeOrgNumber("559876-5432")).toBe("559876-5432");
    expect(normalizeOrgNumber(" 559876 5432 ")).toBe("559876-5432");
  });

  it("keeps a non-standard value as trimmed text", () => {
    expect(normalizeOrgNumber("HRB 12345")).toBe("HRB 12345");
  });

  it("returns null for empty / missing", () => {
    expect(normalizeOrgNumber(null)).toBeNull();
    expect(normalizeOrgNumber("")).toBeNull();
    expect(normalizeOrgNumber("   ")).toBeNull();
  });
});

describe("normalizeVatNumber", () => {
  it("uppercases and strips spaces", () => {
    expect(normalizeVatNumber("se 559876543201")).toBe("SE559876543201");
    expect(normalizeVatNumber("SE559876543201")).toBe("SE559876543201");
  });

  it("returns null for empty / missing", () => {
    expect(normalizeVatNumber(null)).toBeNull();
    expect(normalizeVatNumber("  ")).toBeNull();
  });
});

describe("normalizeSupplier", () => {
  it("returns null when there's no usable name", () => {
    expect(normalizeSupplier({ name: null, orgNumber: "5598765432", vatNumber: null })).toBeNull();
    expect(normalizeSupplier({ name: "  ", orgNumber: null, vatNumber: null })).toBeNull();
  });

  it("trims the name and normalizes identifiers", () => {
    expect(
      normalizeSupplier({ name: "  Telia AB ", orgNumber: "5598765432", vatNumber: "se123" })
    ).toEqual({ name: "Telia AB", orgNumber: "559876-5432", vatNumber: "SE123" });
  });
});

describe("enrichPatch", () => {
  it("backfills only identifiers the existing supplier lacks", () => {
    expect(
      enrichPatch(
        { orgNumber: null, vatNumber: null },
        { orgNumber: "559876-5432", vatNumber: "SE559876543201" }
      )
    ).toEqual({ orgNumber: "559876-5432", vatNumber: "SE559876543201" });
  });

  it("never overwrites an existing non-null identifier", () => {
    expect(
      enrichPatch(
        { orgNumber: "111111-1111", vatNumber: null },
        { orgNumber: "559876-5432", vatNumber: "SE559876543201" }
      )
    ).toEqual({ vatNumber: "SE559876543201" });
  });

  it("is empty when there's nothing new to add", () => {
    expect(
      enrichPatch(
        { orgNumber: "559876-5432", vatNumber: null },
        { orgNumber: null, vatNumber: null }
      )
    ).toEqual({});
  });
});
