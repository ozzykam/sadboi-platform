import { describe, expect, it } from "vitest";
import { summarizeRefunds, returnedQuantity, receivedReturnSchema, readOrderRefundState } from "./store-after-sales";
describe("customer refunds and returns", () => {
  it("reserves pending money, releases failed refunds, and keeps successful refunds separate", () => {
    expect(summarizeRefunds([{ id: "re_a", amountMinor: 1500, status: "succeeded" }, { id: "re_b", amountMinor: 1000, status: "pending" }, { id: "re_c", amountMinor: 500, status: "failed" }], 5000))
      .toEqual({ refundedMinor: 1500, pendingMinor: 1000, availableMinor: 2500 });
    expect(() => summarizeRefunds([{ id: "re_a", amountMinor: 5001, status: "succeeded" }], 5000)).toThrow();
    expect(() => summarizeRefunds([{ id: "re_a", amountMinor: 1.1, status: "succeeded" }], 5000)).toThrow();
  });
  it("rejects duplicate provider records and corrupt saved summaries", () => {
    const refund = { id: "re_a", amountMinor: 100, status: "succeeded" as const };
    expect(() => summarizeRefunds([refund, refund], 5000)).toThrow();
    expect(readOrderRefundState(undefined).activeId).toBeNull();
    expect(() => readOrderRefundState({ refundedMinor: -1 })).toThrow();
  });
  it("caps cumulative returns and requires locations only for retained stock", () => {
    expect(returnedQuantity(3, 1, 2)).toBe(3);
    expect(() => returnedQuantity(3, 2, 2)).toThrow();
    expect(() => returnedQuantity(3, 0, 0.5)).toThrow();
    const input = { orderId: "a".repeat(32), operationId: "00000000-0000-4000-8000-000000000000", expectedRevision: 0, variantId: "b".repeat(64), quantity: 1, disposition: "quarantine", locationId: null, notes: "Damaged packaging" };
    expect(receivedReturnSchema.safeParse(input).success).toBe(false);
    expect(receivedReturnSchema.safeParse({ ...input, locationId: "c".repeat(64) }).success).toBe(true);
    expect(receivedReturnSchema.safeParse({ ...input, disposition: "discard" }).success).toBe(true);
  });
});
