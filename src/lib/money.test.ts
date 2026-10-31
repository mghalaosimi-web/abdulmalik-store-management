import { describe, expect, it } from "vitest";
import { calculateLineTotal, fromMinorUnits, toMinorUnits } from "./money";

describe("money arithmetic", () => {
  it("converts decimal values to integer minor units", () => {
    expect(toMinorUnits(12.34)).toBe(1234);
    expect(fromMinorUnits(1234)).toBe(12.34);
  });

  it("avoids floating point accumulation errors", () => {
    const total = toMinorUnits(0.1) + toMinorUnits(0.2);
    expect(fromMinorUnits(total)).toBe(0.3);
  });

  it("calculates line totals and validates discounts", () => {
    expect(calculateLineTotal(10.25, 3, 0.5)).toBe(3025);
    expect(() => calculateLineTotal(10, 1, 10.01)).toThrow();
    expect(() => toMinorUnits(-1)).toThrow();
  });
});
