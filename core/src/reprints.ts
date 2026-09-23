import { z } from "zod";
import { inventoryId, type InventoryRecord } from "./inventory";
const text = (max: number) => z.string().trim().max(max);
export const reprintInputSchema = z.object({
  orderId: inventoryId, variantId: inventoryId, batchId: inventoryId,
  quantity: z.number().int().min(1).max(1_000_000), reason: text(2000).min(3),
  status: z.enum(["requested", "approved", "in_production", "completed", "cancelled"]),
}).strict();
export type ReprintInput = z.infer<typeof reprintInputSchema>;
export type ReprintRecord = InventoryRecord<ReprintInput> & { sku: string; batchNumber: string; supplierName: string; orderNumber: string };
export type ReprintCatalog = { reprints: ReprintRecord[] };
