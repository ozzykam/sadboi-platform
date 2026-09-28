import { z } from "zod";
export const storePaymentOrderId = z.string().regex(/^[a-f0-9]{32}$/);
export const paymentConfirmationSchema = z.object({
  eventId: z.string().trim().min(8).max(200).regex(/^[a-zA-Z0-9_-]+$/),
  orderId: storePaymentOrderId,
  provider: z.enum(["stripe"]),
  paymentId: z.string().trim().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/),
  amountMinor: z.number().int().positive().max(100_000_000_000),
  currency: z.literal("USD"), status: z.enum(["succeeded", "failed"]),
}).strict();
export type PaymentConfirmation = z.infer<typeof paymentConfirmationSchema>;
export const paymentEventReasons = {
  payment_confirmed: "Payment confirmed for this order.",
  payment_failed: "Payment attempt failed; the order was left awaiting payment.",
  late_failure: "Failure recorded without changing an already paid or closed order.",
  already_paid: "Success already recorded for this payment; no further order change.",
  amount_mismatch: "Payment amount does not match the order total.",
  payment_identity_conflict: "This payment is linked to another order or has inconsistent saved details.",
  additional_payment: "A different payment succeeded for an order that was already paid.",
  late_success: "Payment succeeded after cancellation or the payment deadline. Reconciliation is required.",
  legacy_payment: "Historical payment details need reconciliation before accepting another success.",
  invalid_order_state: "The saved order state needs reconciliation.",
  historical_event: "Historical event retained; its original order effect was not recorded.",
  refunded_payment: "A completed refund was already verified for this payment. The order was not reopened.",
} as const;
export type PaymentEventReason = keyof typeof paymentEventReasons;
export type PaymentEventOutcome = "applied" | "ignored" | "review" | "legacy";
export type StorePaymentResult = {
  id: string; status: PaymentConfirmation["status"]; outcome: PaymentEventOutcome;
  reason: PaymentEventReason; orderStatus: string; duplicate: boolean;
};
export type StorePaymentEvent = {
  id: string; input: PaymentConfirmation; outcome: PaymentEventOutcome;
  reason: PaymentEventReason; receivedAt: string;
  revision?: number;
  verification?: "stripe_lookup" | null;
  source?: { accountId: string; mode: "test" } | null;
  resolution?: { action: string; notes: string; reference: string; actorId: string; createdAt: string } | null;
};
export type PaymentOrderState = {
  status: string; totalMinor: number; paymentId?: string; paymentProvider?: string;
  paymentEventId?: string; paymentSchemaVersion?: number;
  expiresAt?: string;
};
export function decideStorePayment(order: PaymentOrderState, input: PaymentConfirmation, identityConflict = false): {
  outcome: Exclude<PaymentEventOutcome, "legacy">; reason: PaymentEventReason;
} {
  if (identityConflict) return { outcome: "review", reason: "payment_identity_conflict" };
  if (!Number.isSafeInteger(order.totalMinor) || order.totalMinor !== input.amountMinor)
    return { outcome: "review", reason: "amount_mismatch" };
  if (!["pending_payment", "paid", "fulfilled", "cancelled", "expired"].includes(order.status))
    return { outcome: "review", reason: "invalid_order_state" };
  if (input.status === "failed") return { outcome: "ignored", reason: order.status === "pending_payment" ? "payment_failed" : "late_failure" };
  if (["cancelled", "expired"].includes(order.status) || (order.status === "pending_payment" && order.expiresAt && Date.parse(order.expiresAt) <= Date.now()))
    return { outcome: "review", reason: "late_success" };
  if (order.status === "paid" || order.status === "fulfilled") {
    if (!order.paymentId || !order.paymentProvider) return { outcome: "review", reason: "legacy_payment" };
    return order.paymentId === input.paymentId && order.paymentProvider === input.provider
      ? { outcome: "ignored", reason: "already_paid" }
      : { outcome: "review", reason: "additional_payment" };
  }
  // The old handler could regress paid orders and overwrite their payment ID.
  // Never guess whether a pending order with old payment fields was once paid.
  if (order.paymentId || order.paymentEventId || order.paymentProvider)
    return { outcome: "review", reason: "legacy_payment" };
  return { outcome: "applied", reason: "payment_confirmed" };
}
