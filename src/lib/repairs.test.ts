import { describe, expect, it } from "vitest";
import type { RepairStatus } from "./repairs";

const transitions: Record<RepairStatus, RepairStatus[]> = {
  received: ["diagnosing", "cancelled"],
  diagnosing: ["waiting_parts", "in_progress", "cancelled"],
  waiting_parts: ["in_progress", "cancelled"],
  in_progress: ["waiting_parts", "completed", "cancelled"],
  completed: ["delivered"],
  delivered: [],
  cancelled: [],
};

describe("repair workflow rules", () => {
  it("allows only forward operational transitions", () => {
    expect(transitions.received).toContain("diagnosing");
    expect(transitions.completed).toContain("delivered");
    expect(transitions.delivered).toHaveLength(0);
  });

  it("does not allow reopening terminal states", () => {
    expect(transitions.cancelled).toHaveLength(0);
    expect(transitions.delivered).not.toContain("in_progress");
  });
});
