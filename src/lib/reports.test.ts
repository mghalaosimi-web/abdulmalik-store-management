import { describe, expect, it } from "vitest";
import { calculateProfitFromLedger } from "./reports";

describe("calculateProfitFromLedger", () => {
  it("nets sales returns, cost reversals, purchase return variance, and expenses", () => {
    const result = calculateProfitFromLedger([
      { code: "4000", debitMinor: 0, creditMinor: 10000 },
      { code: "4100", debitMinor: 1000, creditMinor: 0 },
      { code: "5000", debitMinor: 6000, creditMinor: 500 },
      { code: "5100", debitMinor: 50, creditMinor: 150 },
      { code: "6000", debitMinor: 2000, creditMinor: 0 },
    ]);
    expect(result).toEqual({
      netSalesMinor: 9000,
      costOfGoodsMinor: 5500,
      purchaseReturnVarianceMinor: 100,
      expensesMinor: 2000,
      grossProfitMinor: 3600,
      netProfitMinor: 1600,
    });
  });

  it("handles an empty ledger as zero profit", () => {
    expect(calculateProfitFromLedger([]).netProfitMinor).toBe(0);
  });

  it("rejects invalid account balances", () => {
    expect(() => calculateProfitFromLedger([{ code: "4000", debitMinor: -1, creditMinor: 0 }])).toThrow();
    expect(() => calculateProfitFromLedger([{ code: "4A00", debitMinor: 0, creditMinor: 1 }])).toThrow();
  });
});
