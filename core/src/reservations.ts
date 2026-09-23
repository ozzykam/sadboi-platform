import { z } from "zod";
import { inventoryId, type InventoryRecord } from "./inventory";
const text = (max: number) => z.string().trim().max(max);
export const reservationInputSchema = z.object({ variantId: inventoryId, locationId: inventoryId, reference: text(160).min(1), purpose: z.enum(["commission", "event", "wholesale", "internal"]), quantity: z.number().int().min(1).max(1_000_000), status: z.enum(["reserved", "allocated", "released", "fulfilled"]), notes: text(2000) }).strict();
export type ReservationInput = z.infer<typeof reservationInputSchema>;
export type ReservationRecord = InventoryRecord<ReservationInput> & { sku: string; variantName: string; locationName: string };
export type ReservationCatalog = { reservations: ReservationRecord[] };
