import { describe, expect, it } from "vitest";
import { calculatePurchaseReturnRefundCapMinor } from "./purchase-returns";

describe("calculatePurchaseReturnRefundCapMinor", () => {
  it("allows the full tax-inclusive invoice amount when all discounted lines are returned", () => {
    expect(calculatePurchaseReturnRefundCapMinor(11500, 10000, 10000, 0)).toBe(11500);
  });

  it("calculates a proportional cap in integer minor units", () => {
    expect(calculatePurchaseReturnRefundCapMinor(11500, 10000, 2500, 0)).toBe(2875);
  });

  it("subtracts prior refunds and never exceeds the invoice total", () => {
    expect(calculatePurchaseReturnRefundCapMinor(11500, 10000, 5000, 2875)).toBe(2875);
    expect(calculatePurchaseReturnRefundCapMinor(11500, 10000, 10000, 11500)).toBe(0);
  });

  it("rejects invalid values and returned value beyond the net subtotal", () => {
    expect(() => calculatePurchaseReturnRefundCapMinor(0, 100, 10, 0)).toThrow();
    expect(() => calculatePurchaseReturnRefundCapMinor(100, 0, 10, 0)).toThrow();
    expect(() => calculatePurchaseReturnRefundCapMinor(100, 100, 101, 0)).toThrow();
    expect(() => calculatePurchaseReturnRefundCapMinor(100, 100, 10, -1)).toThrow();
  });
});
