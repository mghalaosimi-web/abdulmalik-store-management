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
