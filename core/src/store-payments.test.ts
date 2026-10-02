import { expect, it } from "vitest";
import { paymentConfirmationSchema, decideStorePayment, type PaymentConfirmation } from "./store-payments";
it("validates provider payment confirmation payloads", () => { const payload = { eventId: "evt_12345678", orderId: "a".repeat(32), provider: "stripe", paymentId: "pi_123", amountMinor: 5000, currency: "USD", status: "succeeded" }; expect(paymentConfirmationSchema.safeParse(payload).success).toBe(true); expect(paymentConfirmationSchema.safeParse({ ...payload, currency: "EUR" }).success).toBe(false); });
const event: PaymentConfirmation = { eventId: "evt_12345678", orderId: "a".repeat(32), provider: "stripe", paymentId: "pi_123", amountMinor: 5000, currency: "USD", status: "succeeded" };
const pending = { status: "pending_payment", totalMinor: 5000 };
const paid = { ...pending, status: "paid", paymentProvider: "stripe", paymentId: "pi_123", paymentEventId: event.eventId };
it("rejects unsafe identifiers, fractional or zero amounts, and injected fields", () => {
  for (const change of [{ eventId: "../event" }, { eventId: "stripe:evt_other" }, { paymentId: "pi/other" }, { orderId: "../orders/other" }, { amountMinor: 0 }, { amountMinor: 50.5 }, { duplicate: true }])
    expect(paymentConfirmationSchema.safeParse({ ...event, ...change }).success).toBe(false);
});
it("accepts success once and leaves failed attempts pending", () => {
  expect(decideStorePayment(pending, event).outcome).toBe("applied");
  expect(decideStorePayment(pending, { ...event, status: "failed" }).reason).toBe("payment_failed");
  expect(decideStorePayment(paid, event).reason).toBe("already_paid");
});
it("never regresses paid, fulfilled, or cancelled orders on a failure", () => {
  for (const status of ["paid", "fulfilled", "cancelled"])
    expect(decideStorePayment({ ...paid, status }, { ...event, paymentId: "pi_other", status: "failed" })).toEqual({ outcome: "ignored", reason: "late_failure" });
});
it("routes extra payments and late successes to review without reopening orders", () => {
  expect(decideStorePayment({ ...paid, status: "fulfilled" }, event).reason).toBe("already_paid");
  for (const status of ["paid", "fulfilled"])
    expect(decideStorePayment({ ...paid, status }, { ...event, paymentId: "pi_other" })).toEqual({ outcome: "review", reason: "additional_payment" });
  expect(decideStorePayment({ ...pending, status: "cancelled" }, event)).toEqual({ outcome: "review", reason: "late_success" });
});
it("requires amount and identity agreement regardless of event status", () => {
  for (const status of ["succeeded", "failed"] as const) {
    expect(decideStorePayment(pending, { ...event, amountMinor: 4999, status }).reason).toBe("amount_mismatch");
    expect(decideStorePayment(pending, { ...event, status }, true).reason).toBe("payment_identity_conflict");
  }
});
it("ignores a proven original payment after cancellation without suppressing genuine late payments or conflicts", () => {
  for (const status of ["cancelled", "expired"]) {
    const closed = { ...paid, status };
    expect(decideStorePayment(closed, event, false, true)).toEqual({ outcome: "ignored", reason: "already_paid" });
    expect(decideStorePayment(closed, event).reason).toBe("late_success");
    expect(decideStorePayment({ ...pending, status }, event, false, true).reason).toBe("late_success");
    expect(decideStorePayment(closed, { ...event, paymentId: "pi_other" }, false, true).reason).toBe("late_success");
    expect(decideStorePayment(closed, { ...event, amountMinor: 4999 }, false, true).reason).toBe("amount_mismatch");
    expect(decideStorePayment(closed, event, true, true).reason).toBe("payment_identity_conflict");
  }
});
it("does not guess past successful effects from inconsistent historical orders", () => {
  expect(decideStorePayment({ ...pending, paymentId: "pi_legacy_failed" }, event).reason).toBe("legacy_payment");
  expect(decideStorePayment({ ...pending, status: "fulfilled" }, event).reason).toBe("legacy_payment");
  expect(decideStorePayment({ ...pending, status: "unknown" }, event).reason).toBe("invalid_order_state");
});
