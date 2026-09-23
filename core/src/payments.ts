import { z } from "zod";
import { inventoryId, type InventoryRecord } from "./inventory";
const text = (max: number) => z.string().trim().max(max);
export const paymentInputSchema = z.object({ billId: inventoryId, amountMinor: z.number().int().min(1).max(100_000_000_000), method: z.enum(["bank_transfer", "card", "cash", "other"]), reference: text(160), status: z.enum(["attempted", "settled", "failed", "void"]), paymentDate: z.iso.date(), notes: text(2000) }).strict();
export type PaymentInput = z.infer<typeof paymentInputSchema>;
export type PaymentRecord = InventoryRecord<PaymentInput> & { invoiceNumber: string; supplierName: string };
export type PaymentCatalog = { payments: PaymentRecord[] };
