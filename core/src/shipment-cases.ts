import { z } from "zod";
import { inventoryId } from "./inventory";
import { storePaymentOrderId } from "./store-payments";

export const shipmentCaseStatuses = ["open", "investigating", "resolved"] as const;
export const shipmentCaseInputSchema = z.object({
  kind: z.enum(["damaged", "lost"]), status: z.enum(shipmentCaseStatuses),
  items: z.array(z.object({ variantId: inventoryId, quantity: z.number().int().min(1).max(1000) }).strict()).min(1).max(20),
  carrier: z.string().trim().max(120), claimReference: z.string().trim().max(160),
  evidence: z.string().trim().max(2000), note: z.string().trim().min(3).max(2000),
  resolution: z.enum(["refund", "replacement", "located", "no_refund"]).nullable(),
  refundId: inventoryId.nullable(), returnId: inventoryId.nullable(),
}).strict().superRefine((input, ctx) => {
  const invalid = new Set(input.items.map(item => item.variantId)).size !== input.items.length ||
    (input.status === "resolved") !== (input.resolution !== null) ||
    (input.resolution === "refund") !== (input.refundId !== null) ||
    (input.resolution === "located" && input.kind !== "lost");
  if (invalid) ctx.addIssue({ code: "custom", message: "Choose unique affected items and a valid resolution. Only a refund resolution links a refund; located applies to lost shipments." });
});
export type ShipmentCaseInput = z.infer<typeof shipmentCaseInputSchema>;
export const shipmentCaseRequestSchema = z.object({ orderId: storePaymentOrderId, operationId: z.uuid(),
  expectedRevision: z.number().int().min(0).max(100), input: shipmentCaseInputSchema }).strict();
export type ShipmentCaseRequest = z.infer<typeof shipmentCaseRequestSchema>;

export function validateShipmentCase(previous: ShipmentCaseInput | null, next: ShipmentCaseInput, lines: { variantId: string; quantity: number }[]) {
  shipmentCaseInputSchema.parse(next);
  if (!previous && next.status !== "open") throw new Error("Start a new shipment case with status Open.");
  if (previous?.status === "resolved" && next.status !== "investigating") throw new Error("Reopen a resolved case as Investigating before changing it.");
  if (next.items.some(item => !lines.some(line => line.variantId === item.variantId && item.quantity <= line.quantity)))
    throw new Error("Affected quantities must belong to this order and cannot exceed dispatched quantities.");
}

export const replacementStatusSchema = z.enum(["prepared", "shipped", "delivered", "cancelled"]);
export type ReplacementStatus = z.infer<typeof replacementStatusSchema>;
export const replacementDestinationSchema = z.object({ recipientName: z.string().min(1).max(160), address1: z.string().min(1).max(200), address2: z.string().max(200), city: z.string().min(1).max(120), region: z.string().min(1).max(120), postalCode: z.string().min(1).max(40), country: z.literal("US") }).strict();
const common = { orderId: storePaymentOrderId, operationId: z.uuid(), note: z.string().trim().min(3).max(2000) };
export const replacementRequestSchema = z.discriminatedUnion("action", [
  z.object({ ...common, action: z.literal("prepare"), expectedCaseRevision: z.number().int().min(1).max(100),
    items: z.array(z.object({ variantId: inventoryId, quantity: z.number().int().min(1).max(1000), locationId: inventoryId.nullable() }).strict()).min(1).max(20) }).strict(),
  z.object({ ...common, action: z.literal("update"), replacementId: inventoryId, expectedRevision: z.number().int().min(1).max(100),
    status: replacementStatusSchema, trackingNumber: z.string().trim().max(160) }).strict(),
]);
export type ReplacementRequest = z.infer<typeof replacementRequestSchema>;
export function replacementEffect(previous: ReplacementStatus, next: ReplacementStatus) {
  if (previous === "prepared" && next === "shipped") return "consume";
  if (previous === "prepared" && next === "cancelled") return "release";
  if (previous === "shipped" && (next === "shipped" || next === "delivered")) return "none";
  throw new Error("A prepared replacement can ship or cancel. A shipped replacement can update tracking or be delivered. Terminal replacements cannot change.");
}
