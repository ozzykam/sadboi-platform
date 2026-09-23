import { z } from "zod";
import { inventoryId, type InventoryRecord } from "./inventory";
const text = (max: number) => z.string().trim().max(max);
export const batchInputSchema = z.object({
  orderId: inventoryId, variantId: inventoryId, batchNumber: text(80).min(1),
  quantity: z.number().int().min(1).max(1_000_000), waste: z.number().int().min(0).max(1_000_000),
  status: z.enum(["planned", "in_production", "completed", "cancelled"]), notes: text(2000),
}).strict().refine(input => input.waste <= input.quantity, { message: "Waste cannot exceed batch quantity.", path: ["waste"] });
export type BatchInput = z.infer<typeof batchInputSchema>;
export type BatchRecord = InventoryRecord<BatchInput> & { sku: string; variantName: string; supplierName: string; orderNumber: string };
export type BatchCatalog = { batches: BatchRecord[] };
