import { z } from "zod";
import { inventoryId, type InventoryRecord } from "./inventory";
const text = (max: number) => z.string().trim().max(max);
const addressSchema = z
  .object({
    line1: text(180).min(1),
    line2: text(180),
    city: text(100).min(1),
    region: text(100).min(1),
    postalCode: text(24).min(1),
    country: text(2).length(2).default("US"),
  })
  .strict();
export const storeOrderInputSchema = z
  .object({
    customerName: text(160).min(1),
    customerEmail: z.email().max(254),
    notes: text(2000),
    fulfillmentMethod: z.enum(["shipping", "pickup"]).default("pickup"),
    shippingAddress: addressSchema.nullable().optional(),
    lines: z
      .array(
        z
          .object({
            variantId: inventoryId,
            quantity: z.number().int().min(1).max(1000),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      new Set(input.lines.map((line) => line.variantId)).size !==
      input.lines.length
    )
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Use each product variant once per order.",
      });
    if (input.fulfillmentMethod === "shipping" && !input.shippingAddress)
      context.addIssue({
        code: "custom",
        path: ["shippingAddress"],
        message: "A shipping address is required.",
      });
  });
export type StoreOrderInput = z.infer<typeof storeOrderInputSchema>;
export const storeOrderRequestSchema = z
  .object({
    operationId: z.uuid(),
    input: storeOrderInputSchema,
  })
  .strict();
export type StoreOrderRecord = InventoryRecord<StoreOrderInput> & {
  orderNumber: string;
  totalMinor: number;
  status: "pending_payment" | "paid" | "cancelled" | "fulfilled";
};
