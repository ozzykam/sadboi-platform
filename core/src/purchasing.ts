import { z } from "zod";
import { inventoryId, type InventoryRecord } from "./inventory";

const text = (length: number) => z.string().trim().max(length);
const units = z.number().int().min(0).max(1_000_000);
export const supplierInputSchema = z.object({
  name: text(160).min(1), contactName: text(160), email: z.union([z.literal(""), z.email().max(254)]),
  phone: text(80), address: text(1000), capabilities: text(2000),
  leadTimeDays: z.number().int().min(0).max(3650).nullable(), capacityUnitsPerDay: z.number().int().min(1).max(1_000_000).nullable().optional(), notes: text(2000),
  status: z.enum(["active", "archived"]),
}).strict();
export const purchaseLineSchema = z.object({
  variantId: inventoryId, quantity: units.refine(value => value > 0, "Order at least one unit."),
  unitCostMinor: z.number().int().min(0).max(100_000_000), specification: text(2000).min(1),
}).strict();
export const purchaseOrderInputSchema = z.object({
  supplierId: inventoryId, quoteId: z.union([z.literal(""), inventoryId]).default(""), reference: text(160), expectedDate: z.union([z.literal(""), z.iso.date()]),
  notes: text(2000), currency: z.literal("USD"), lines: z.array(purchaseLineSchema).min(1).max(20),
}).strict().refine(input => new Set(input.lines.map(line => line.variantId)).size === input.lines.length, { message: "Use each SKU once per purchase order.", path: ["lines"] })
  .refine(input => input.lines.reduce((sum, line) => sum + line.quantity * line.unitCostMinor, 0) <= 100_000_000_000, { message: "The order subtotal exceeds the supported limit.", path: ["lines"] });
export const purchaseActionSchema = z.object({
  orderId: inventoryId, expectedRevision: z.number().int().positive(), action: z.enum(["place", "close"]), reason: text(1000).min(3),
}).strict();
export const productionStages = ["queued", "proofing", "in_production", "ready", "shipped", "on_hold"] as const;
export const purchaseProductionSchema = z.object({
  orderId: inventoryId, variantId: inventoryId, expectedRevision: z.number().int().positive(),
  stage: z.enum(productionStages), expectedDate: z.union([z.literal(""), z.iso.date()]),
  note: text(1000).min(3), reference: text(160),
}).strict();
export type PurchaseProductionInput = z.infer<typeof purchaseProductionSchema>;
export type ProductionStage = PurchaseProductionInput["stage"];
export type PurchaseProductionUpdate = Omit<PurchaseProductionInput, "expectedRevision"> & {
  id: string; sku: string; actorId: string; createdAt: string;
};
export const purchaseReceiptSchema = z.object({
  orderId: inventoryId, variantId: inventoryId, locationId: inventoryId,
  accepted: units, quarantined: units, rejected: units, reason: text(1000).min(3), reference: text(160),
}).strict().refine(input => input.accepted + input.quarantined + input.rejected > 0 && input.accepted + input.quarantined + input.rejected <= 1_000_000, { message: "Record between 1 and 1,000,000 delivered units.", path: ["accepted"] });

export type SupplierInput = z.infer<typeof supplierInputSchema>;
export type SupplierRecord = InventoryRecord<SupplierInput>;
export type PurchaseOrderInput = z.infer<typeof purchaseOrderInputSchema>;
export type PurchaseReceiptInput = z.infer<typeof purchaseReceiptSchema>;
export type PurchaseLine = z.infer<typeof purchaseLineSchema> & {
  sku: string; variantName: string; productTitle: string; accepted: number; quarantined: number; rejected: number; cancelled: number;
};
export type PurchaseOrderRecord = {
  id: string; number: string; revision: number; supplierId: string; quoteId?: string; supplier: SupplierInput;
  quoteSnapshot?: { id: string; reference: string; totalMinor: number; effectiveUnitCostMinor: number; specification: string } | null;
  reference: string; expectedDate: string; notes: string; currency: "USD"; lines: PurchaseLine[]; subtotalMinor: number;
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled" | "closed";
  createdAt: string; updatedAt: string; orderedAt: string | null; closedAt: string | null; closeReason: string;
  production: PurchaseProductionUpdate[];
};
export type PurchasingCatalog = { suppliers: SupplierRecord[]; orders: PurchaseOrderRecord[] };
export type PurchaseReceipt = PurchaseReceiptInput & { id: string; orderNumber: string; sku: string; locationName: string; unitCostMinor: number; actorId: string; createdAt: string };
export function purchaseProductionQueue(orders: PurchaseOrderRecord[]) {
  return orders.filter(order => ["ordered", "partially_received"].includes(order.status)).flatMap(order =>
    order.lines.filter(line => purchaseRemaining(line) > 0).map(line => {
      const latest = order.production.find(update => update.variantId === line.variantId);
      return {
        orderId: order.id, orderNumber: order.number, supplierName: order.supplier.name,
        variantId: line.variantId, sku: line.sku, variantName: line.variantName, outstanding: purchaseRemaining(line),
        capacityUnitsPerDay: order.supplier.capacityUnitsPerDay ?? null,
        estimatedProductionDays: productionDays(purchaseRemaining(line), order.supplier.capacityUnitsPerDay),
        stage: latest?.stage ?? ("unreported" as const),
        expectedDate: latest ? latest.expectedDate : order.expectedDate,
        note: latest?.note ?? "", reference: latest?.reference ?? "",
      };
    })
  ).sort((a, b) => Number(!a.expectedDate) - Number(!b.expectedDate) || a.expectedDate.localeCompare(b.expectedDate) || a.orderNumber.localeCompare(b.orderNumber) || a.sku.localeCompare(b.sku));
}
export function purchaseRemaining(line: Pick<PurchaseLine, "quantity" | "accepted" | "quarantined" | "rejected" | "cancelled">) {
  const remaining = line.quantity - line.accepted - line.quarantined - line.rejected - line.cancelled;
  if (!Number.isSafeInteger(remaining) || remaining < 0) throw new Error("Invalid purchase-order quantities.");
  return remaining;
}
export function productionDays(outstanding: number, capacityUnitsPerDay: number | null | undefined) {
  if (!capacityUnitsPerDay || outstanding <= 0) return null;
  return Math.ceil(outstanding / capacityUnitsPerDay);
}
export function receivePurchaseLine(line: PurchaseLine, receipt: Pick<PurchaseReceiptInput, "accepted" | "quarantined" | "rejected">): PurchaseLine {
  const counts = [receipt.accepted, receipt.quarantined, receipt.rejected];
  if (counts.some(count => !Number.isSafeInteger(count) || count < 0)) throw new Error("Invalid received quantities.");
  const delivered = counts.reduce((sum, count) => sum + count, 0);
  if (delivered < 1 || delivered > purchaseRemaining(line)) throw new Error("Delivery exceeds the units still outstanding on this order.");
  return { ...line, accepted: line.accepted + receipt.accepted, quarantined: line.quarantined + receipt.quarantined, rejected: line.rejected + receipt.rejected };
}
