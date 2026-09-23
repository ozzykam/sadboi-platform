import { z } from "zod";
import { inventoryId, type InventoryRecord } from "./inventory";
const text = (max: number) => z.string().trim().max(max);
export const vendorBillInputSchema = z.object({
  supplierId: inventoryId, purchaseOrderId: z.union([z.literal(""), inventoryId]), invoiceNumber: text(160).min(1),
  invoiceDate: z.iso.date(), dueDate: z.union([z.literal(""), z.iso.date()]), currency: z.literal("USD"),
  subtotalMinor: z.number().int().min(0).max(100_000_000_000), shippingMinor: z.number().int().min(0).max(100_000_000_000),
  taxMinor: z.number().int().min(0).max(100_000_000_000), status: z.enum(["draft", "received", "approved", "paid", "void"]), notes: text(2000),
}).strict().refine(input => !input.dueDate || input.dueDate >= input.invoiceDate, { message: "Due date cannot be before invoice date.", path: ["dueDate"] });
export type VendorBillInput = z.infer<typeof vendorBillInputSchema>;
export type VendorBillRecord = InventoryRecord<VendorBillInput> & { supplierName: string; orderNumber: string; totalMinor: number };
export type FinanceCatalog = { bills: VendorBillRecord[] };
export function vendorBillTotal(input: Pick<VendorBillInput, "subtotalMinor" | "shippingMinor" | "taxMinor">) { return input.subtotalMinor + input.shippingMinor + input.taxMinor; }
