import { z } from "zod";
import { inventoryId } from "./inventory";
import { storePaymentOrderId } from "./store-payments";

const revision = z.number().int().min(0).max(1_000_000_000);
const amount = z.number().int().min(0).max(99_999_999);
export const providerRefundSchema = z.object({ id: z.string().regex(/^re_[a-zA-Z0-9]+$/), amountMinor: amount.positive(),
  status: z.enum(["pending", "requires_action", "succeeded", "failed", "canceled"]) }).strict();
export type ProviderRefund = z.infer<typeof providerRefundSchema>;
export const orderRefundStateSchema = z.object({ revision, activeId: inventoryId.nullable(), refundedMinor: amount, pendingMinor: amount,
  checkedAt: z.string().nullable(), refunds: z.array(providerRefundSchema).max(100) }).strict();
export type OrderRefundState = z.infer<typeof orderRefundStateSchema>;
export function readOrderRefundState(value: unknown): OrderRefundState {
  return value === undefined ? { revision: 0, activeId: null, refundedMinor: 0, pendingMinor: 0, checkedAt: null, refunds: [] } : orderRefundStateSchema.parse(value);
}
export function summarizeRefunds(refunds: ProviderRefund[], paidMinor: number) {
  amount.parse(paidMinor);
  const rows = z.array(providerRefundSchema).max(100).parse(refunds);
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error("Duplicate provider refund identity.");
  const refundedMinor = rows.filter(row => row.status === "succeeded").reduce((sum, row) => sum + row.amountMinor, 0);
  const pendingMinor = rows.filter(row => ["pending", "requires_action"].includes(row.status)).reduce((sum, row) => sum + row.amountMinor, 0);
  if (refundedMinor + pendingMinor > paidMinor) throw new Error("Refund amounts exceed the payment.");
  return { refundedMinor, pendingMinor, availableMinor: paidMinor - refundedMinor - pendingMinor };
}
export const orderRefundRequestSchema = z.object({ orderId: storePaymentOrderId, operationId: z.uuid(), expectedRevision: revision,
  amountMinor: amount.positive(), reason: z.string().trim().min(3).max(1000) }).strict();
export type OrderRefundRequest = z.infer<typeof orderRefundRequestSchema>;
export const receivedReturnSchema = z.object({ orderId: storePaymentOrderId, operationId: z.uuid(), expectedRevision: revision,
  variantId: inventoryId, quantity: z.number().int().min(1).max(1000), disposition: z.enum(["sellable", "quarantine", "discard"]),
  locationId: inventoryId.nullable(), notes: z.string().trim().min(3).max(1000) }).strict().superRefine((value, ctx) => {
  if ((value.disposition === "discard") !== (value.locationId === null)) ctx.addIssue({ code: "custom", message: "Choose a stock location for retained returns; discarded items have no stock location." });
});
export type ReceivedReturn = z.infer<typeof receivedReturnSchema>;
export const returnStateSchema = z.object({ revision, quantities: z.record(inventoryId, z.number().int().min(0).max(1000)) }).strict();
export function readReturnState(value: unknown) { return value === undefined ? { revision: 0, quantities: {} as Record<string, number> } : returnStateSchema.parse(value); }
export function returnedQuantity(sold: number, received: number, quantity: number) {
  if (![sold, received, quantity].every(Number.isSafeInteger) || sold < 1 || received < 0 || quantity < 1 || received + quantity > sold)
    throw new Error("The returned quantity exceeds the units dispatched or collected.");
  return received + quantity;
}
