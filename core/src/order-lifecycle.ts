import { z } from "zod";
import { storePaymentOrderId } from "./store-payments";
export const orderHoldMinutes = 30;
export const orderCloseSchema = z.object({
  orderId: storePaymentOrderId, operationId: z.uuid(),
  reason: z.string().trim().min(3).max(1000),
}).strict();
export const paymentReviewSchema = z.object({
  orderId: storePaymentOrderId, eventId: z.string().min(8).max(300).regex(/^[a-zA-Z0-9_:-]+$/),
  operationId: z.uuid(), expectedRevision: z.number().int().min(0),
  action: z.enum(["accept_payment", "record_refund", "dismiss"]),
  reference: z.string().trim().max(200), notes: z.string().trim().min(10).max(2000),
}).strict().refine(value => value.action !== "record_refund" || /^re_[a-zA-Z0-9]+$/.test(value.reference), {
  message: "Enter the completed Stripe refund ID.", path: ["reference"],
});
export function orderIsDue(order: { status: string; expiresAt?: string | null }, now = Date.now()) {
  return order.status === "pending_payment" && typeof order.expiresAt === "string" &&
    Number.isFinite(Date.parse(order.expiresAt)) && Date.parse(order.expiresAt) <= now;
}
