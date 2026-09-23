import { z } from "zod";
import { inventoryId, type InventoryRecord } from "./inventory";
const text = (max: number) => z.string().trim().max(max);
export const quoteInputSchema = z.object({
  supplierId: inventoryId, variantId: inventoryId, reference: text(160), quantity: z.number().int().min(1).max(1_000_000),
  unitCostMinor: z.number().int().min(0).max(100_000_000), setupCostMinor: z.number().int().min(0).max(100_000_000), shippingCostMinor: z.number().int().min(0).max(100_000_000),
  expectedDate: z.union([z.literal(""), z.iso.date()]), expiresDate: z.union([z.literal(""), z.iso.date()]), specification: text(2000).min(1), status: z.enum(["draft", "received", "accepted", "rejected", "expired"]), notes: text(2000),
}).strict().refine(value => !value.expiresDate || !value.expectedDate || value.expiresDate >= value.expectedDate, { message: "Expiry cannot be before expected delivery.", path: ["expiresDate"] });
export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type QuoteRecord = InventoryRecord<QuoteInput> & { supplierName: string; sku: string; variantName: string; productTitle: string; totalMinor: number; effectiveUnitCostMinor: number };
export type QuoteCatalog = { quotes: QuoteRecord[] };
export function quoteTotal(input: Pick<QuoteInput, "quantity" | "unitCostMinor" | "setupCostMinor" | "shippingCostMinor">) { return input.quantity * input.unitCostMinor + input.setupCostMinor + input.shippingCostMinor; }
export function quoteEffectiveUnitCost(input: Pick<QuoteInput, "quantity" | "unitCostMinor" | "setupCostMinor" | "shippingCostMinor">) { return Math.ceil(quoteTotal(input) / input.quantity); }
