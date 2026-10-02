import { expect, it } from "vitest";
import { disputeStatuses, disputeNeedsSync, disputeBlocksDispatch, readDisputeState, disputeCommandSchema } from "./store-disputes";
it("holds open inquiries, chargebacks and losses without holding won, closed or prevented disputes", () => {
  for (const status of disputeStatuses) {
    expect(disputeNeedsSync(status)).toBe(["warning_needs_response", "warning_under_review", "needs_response", "under_review"].includes(status));
    expect(disputeBlocksDispatch(status)).toBe(!["won", "warning_closed", "prevented"].includes(status));
  }
});
it("distinguishes orders never checked from invalid saved dispute summaries", () => {
  expect(readDisputeState(undefined)).toEqual({ revision: 0, checkedAt: null, rows: [] });
  for (const raw of [null, {}, { revision: 1, checkedAt: null, rows: [{ status: "won" }] }]) expect(() => readDisputeState(raw)).toThrow();
});
it("accepts bounded private notes without accepting provider status or arbitrary refresh fields", () => {
  const request = { action: "note", orderId: "a".repeat(32), id: "b".repeat(64), operationId: "123e4567-e89b-42d3-a456-426614174000", expectedRevision: 0, input: { plan: "challenge", evidence: "Delivery receipt", note: "Prepare evidence" } };
  expect(disputeCommandSchema.safeParse(request).success).toBe(true);
  expect(disputeCommandSchema.safeParse({ ...request, input: { ...request.input, status: "won" } }).success).toBe(false);
  expect(disputeCommandSchema.safeParse({ action: "refresh", orderId: request.orderId, paymentId: "pi_other" }).success).toBe(false);
});
