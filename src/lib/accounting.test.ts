import { describe, expect, it } from "vitest";
import { validateJournalLines } from "./accounting";

describe("double-entry journal validation", () => {
  it("accepts a balanced journal", () => {
    expect(() => validateJournalLines([
      { accountCode: "1000", debitMinor: 12500 },
      { accountCode: "4000", creditMinor: 12500 },
    ])).not.toThrow();
  });

  it("rejects unbalanced or one-sided entries", () => {
    expect(() => validateJournalLines([
      { accountCode: "1000", debitMinor: 1000 },
      { accountCode: "4000", creditMinor: 999 },
    ])).toThrow();
    expect(() => validateJournalLines([{ accountCode: "1000", debitMinor: 1000 }])).toThrow();
  });

  it("rejects a line with both debit and credit", () => {
    expect(() => validateJournalLines([
      { accountCode: "1000", debitMinor: 1000, creditMinor: 1000 },
      { accountCode: "4000", creditMinor: 1000 },
    ])).toThrow();
  });
});
