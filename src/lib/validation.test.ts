import { describe, expect, it } from "vitest";
import { normalizeSearchTerm, parseNonNegativeInteger } from "./validation";

describe("parseNonNegativeInteger", () => {
  it("accepts zero and positive integers", () => {
    expect(parseNonNegativeInteger("0")).toBe(0);
    expect(parseNonNegativeInteger("42")).toBe(42);
  });

  it("rejects negative, decimal, and non-numeric values", () => {
    expect(() => parseNonNegativeInteger("-1")).toThrow();
    expect(() => parseNonNegativeInteger("1.5")).toThrow();
    expect(() => parseNonNegativeInteger("abc")).toThrow();
  });
});

describe("normalizeSearchTerm", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeSearchTerm("  iPhone   15 Pro  ")).toBe("iPhone 15 Pro");
  });
});

describe("IMEI validation", () => {
  it("accepts a valid 15-digit IMEI and rejects invalid values", async () => {
    const { isValidImei } = await import("./validation");
    expect(isValidImei("490154203237518")).toBe(true);
    expect(isValidImei("490154203237519")).toBe(false);
    expect(isValidImei("12345")).toBe(false);
  });
});

describe("product validation", () => {
  it("rejects invalid prices and fractional stock quantities", async () => {
    const { validateProductInput } = await import("./validation");
    const valid = { sku: "SKU-1", name: "Phone", category: "Phones", costPrice: 100, salePrice: 120, quantity: 2, minQuantity: 1 };
    expect(() => validateProductInput(valid)).not.toThrow();
    expect(() => validateProductInput({ ...valid, quantity: 1.5 })).toThrow();
    expect(() => validateProductInput({ ...valid, salePrice: -1 })).toThrow();
  });
});
