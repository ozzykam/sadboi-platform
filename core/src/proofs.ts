import { z } from "zod";
import { inventoryId, type InventoryRecord } from "./inventory";

const text = (max: number) => z.string().trim().max(max);
export const proofInputSchema = z.object({
  orderId: inventoryId,
  variantId: inventoryId,
  assetId: inventoryId,
  version: z.number().int().min(1).max(500),
  status: z.enum(["draft", "sent", "changes_requested", "approved", "superseded"]),
  notes: text(2000),
}).strict();
export type ProofInput = z.infer<typeof proofInputSchema>;
export type ProofRecord = InventoryRecord<ProofInput> & {
  filename: string;
  sku: string;
  variantName: string;
  supplierName: string;
  orderNumber: string;
  artworkId: string;
};
export type ProofAsset = { id: string; filename: string; createdAt: string; artworkId: string };
export type ProofCatalog = { proofs: ProofRecord[]; assets: ProofAsset[] };
