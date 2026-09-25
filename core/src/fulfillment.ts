import { z } from "zod";
import { inventoryId, type InventoryRecord } from "./inventory";
const text = (max: number) => z.string().trim().max(max);
export const fulfillmentInputSchema = z.object({
  orderId: z.string().regex(/^[a-f0-9]{32}$/),
  recipientName: text(160).min(1), address1: text(200), address2: text(200),
  city: text(120), region: text(120), postalCode: text(40), country: z.literal("US"),
  method: z.enum(["pickup", "standard", "express"]), trackingNumber: text(160),
  status: z.enum(["unfulfilled", "packed", "shipped", "delivered", "cancelled"]), notes: text(2000),
}).strict().superRefine((input, context) => {
  if (input.method !== "pickup" && input.status !== "cancelled")
    for (const key of ["address1", "city", "region", "postalCode"] as const)
      if (!input[key]) context.addIssue({ code: "custom", path: [key], message: "A shipping address is required." });
  if (input.method === "pickup" && input.status === "shipped")
    context.addIssue({ code: "custom", path: ["status"], message: "Pickup orders are delivered at collection, not shipped." });
});
export type FulfillmentInput = z.infer<typeof fulfillmentInputSchema>;
export type FulfillmentRecord = InventoryRecord<FulfillmentInput>;
export type FulfillmentStatus = FulfillmentInput["status"];
export const fulfillmentRequestSchema = z.object({
  operationId: z.uuid(), expectedRevision: z.number().int().min(0).max(1_000_000_000), input: fulfillmentInputSchema,
}).strict();
export type FulfillmentRequest = z.infer<typeof fulfillmentRequestSchema>;
export function fulfillmentStatuses(status: FulfillmentStatus, method: FulfillmentInput["method"]): FulfillmentStatus[] {
  switch (status) {
    case "unfulfilled": return ["unfulfilled", "packed", "cancelled"];
    case "packed": return ["packed", method === "pickup" ? "delivered" : "shipped", "cancelled"];
    case "shipped": return ["shipped", "delivered"];
    default: return [];
  }
}
export function fulfillmentEffect(previous: FulfillmentInput | null, next: FulfillmentInput): "none" | "consume" | "release" {
  const status = previous?.status ?? "unfulfilled";
  if (!fulfillmentStatuses(status, next.method).includes(next.status)) throw new Error("This fulfillment transition is not allowed. Refresh the order.");
  if (previous?.status === "shipped") {
    for (const key of ["method", "recipientName", "address1", "address2", "city", "region", "postalCode", "country"] as const)
      if (previous[key] !== next[key]) throw new Error("The recipient, address, and method cannot change after dispatch.");
  }
  if (next.status === "cancelled") return "release";
  if (status === "packed" && (next.status === "shipped" || next.status === "delivered")) return "consume";
  return "none";
}
// Checkout snapshots remain authoritative when the live catalog changes.
export const fulfillmentLinesSchema = z.array(z.object({
  variantId: inventoryId, quantity: z.number().int().min(1).max(1000),
  sku: text(60).min(1), name: text(160).min(1), productTitle: text(160).min(1),
  fulfillment: z.enum(["stocked", "made_to_order"]),
  allocations: z.array(z.object({ locationId: inventoryId, quantity: z.number().int().min(1).max(1000) }).strict()).max(100),
})).min(1).max(20).superRefine((lines, context) => {
  const invalid = new Set(lines.map(line => line.variantId)).size !== lines.length ||
    lines.reduce((sum, line) => sum + line.allocations.length, 0) > 100 ||
    lines.some(line => new Set(line.allocations.map(a => a.locationId)).size !== line.allocations.length ||
      (line.fulfillment === "made_to_order" ? line.allocations.length !== 0 : line.allocations.reduce((sum, a) => sum + a.quantity, 0) !== line.quantity));
  if (invalid) context.addIssue({ code: "custom", message: "The order needs allocation review before fulfillment." });
});
export function fulfillmentDisposition(status: FulfillmentStatus) {
  return status === "cancelled" ? "released" : status === "shipped" || status === "delivered" ? "consumed" : "held";
}
