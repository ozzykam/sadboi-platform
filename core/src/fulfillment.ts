import { z } from "zod";
import { inventoryId, type InventoryRecord } from "./inventory";
const text = (max: number) => z.string().trim().max(max);
export const fulfillmentInputSchema = z.object({ orderId: z.string().trim().min(16).max(100), recipientName: text(160).min(1), address1: text(200).min(1), address2: text(200), city: text(120).min(1), region: text(120).min(1), postalCode: text(40).min(1), country: z.literal("US"), method: z.enum(["pickup", "standard", "express"]), trackingNumber: text(160), status: z.enum(["unfulfilled", "packed", "shipped", "delivered", "cancelled"]), notes: text(2000) }).strict();
export type FulfillmentInput = z.infer<typeof fulfillmentInputSchema>;
export type FulfillmentRecord = InventoryRecord<FulfillmentInput>;
