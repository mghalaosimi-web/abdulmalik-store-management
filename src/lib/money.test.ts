import { describe, expect, it } from "vitest";
import { calculateLineTotal, DEFAULT_CURRENCY_CODE, formatMoney, fromMinorUnits, toMinorUnits } from "./money";

describe("money arithmetic", () => {
  it("converts decimal values to integer minor units", () => {
    expect(toMinorUnits(12.34)).toBe(1234);
    expect(fromMinorUnits(1234)).toBe(12.34);
  });

  it("avoids floating point accumulation errors", () => {
    const total = toMinorUnits(0.1) + toMinorUnits(0.2);
    expect(fromMinorUnits(total)).toBe(0.3);
  });

  it("uses Saudi Riyal as the project default currency", () => {
    expect(DEFAULT_CURRENCY_CODE).toBe("SAR");
    expect(formatMoney(12.34)).toContain("ر.س");
  });

  it("calculates line totals and validates discounts", () => {
    expect(calculateLineTotal(10.25, 3, 0.5)).toBe(3025);
    expect(() => calculateLineTotal(10, 1, 10.01)).toThrow();
    expect(() => toMinorUnits(-1)).toThrow();
  });
});
