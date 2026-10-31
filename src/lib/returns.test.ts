import { describe, expect, it } from "vitest";
import { allocateRefundMinorUnits } from "./returns";

describe("allocateRefundMinorUnits", () => {
  it("allocates the complete refund across multiple lines", () => {
    const allocation = allocateRefundMinorUnits(10001, [10000, 20000, 30000]);
    expect(allocation).toHaveLength(3);
    expect(allocation.reduce((sum, amount) => sum + amount, 0)).toBe(10001);
    expect(allocation).toEqual([1667, 3334, 5000]);
  });

  it("preserves every minor unit for tiny refunds", () => {
    expect(allocateRefundMinorUnits(1, [1, 1, 1])).toEqual([0, 1, 0]);
  });

  it("rejects invalid refund or line values", () => {
    expect(() => allocateRefundMinorUnits(0, [100])).toThrow();
    expect(() => allocateRefundMinorUnits(100, [])).toThrow();
    expect(() => allocateRefundMinorUnits(100, [100, -1])).toThrow();
    expect(() => allocateRefundMinorUnits(100, [0, 0])).toThrow();
  });
});
