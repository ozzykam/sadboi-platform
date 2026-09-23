import { z } from "zod";
import { inventoryId, type InventoryRecord } from "./inventory";
const text = (max: number) => z.string().trim().max(max);
export const refundInputSchema = z.object({ paymentId: inventoryId, amountMinor: z.number().int().min(1).max(100_000_000_000), reason: text(2000).min(3), status: z.enum(["requested", "approved", "settled", "rejected"]), refundDate: z.iso.date(), reference: text(160) }).strict();
export type RefundInput = z.infer<typeof refundInputSchema>;
export type RefundRecord = InventoryRecord<RefundInput> & { invoiceNumber: string; supplierName: string };
export type RefundCatalog = { refunds: RefundRecord[] };
