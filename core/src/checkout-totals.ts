import { z } from "zod";

export const checkoutAmount = z.number().int().min(0).max(99_999_999);
export const checkoutTotalsSchema = z.object({
  version: z.literal(1), currency: z.literal("USD"),
  subtotalMinor: checkoutAmount, shippingMinor: checkoutAmount,
  taxMinor: z.null(), taxStatus: z.literal("not_calculated"), totalMinor: checkoutAmount,
  deliveryMethod: z.enum(["pickup", "standard", "express"]),
  deliveryLabel: z.string().min(1).max(100),
  policyRevision: z.number().int().min(0),
}).strict().superRefine((value, ctx) => {
  if (value.totalMinor !== value.subtotalMinor + value.shippingMinor || (value.deliveryMethod === "pickup" && value.shippingMinor !== 0))
    ctx.addIssue({ code: "custom", message: "The saved checkout amounts do not balance." });
});
export type CheckoutTotals = z.infer<typeof checkoutTotalsSchema>;

export function calculateCheckoutTotals(lines: Array<{ quantity: number; priceMinor: number }>, delivery: Pick<CheckoutTotals, "shippingMinor" | "deliveryMethod" | "deliveryLabel" | "policyRevision">): CheckoutTotals {
  if (!lines.length || lines.length > 20 || lines.some(line => !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000 || !checkoutAmount.safeParse(line.priceMinor).success))
    throw new Error("The cart contains invalid quantities or prices.");
  const subtotalMinor = lines.reduce((total, line) => total + line.quantity * line.priceMinor, 0);
  return checkoutTotalsSchema.parse({ version: 1, currency: "USD", subtotalMinor, ...delivery,
    taxMinor: null, taxStatus: "not_calculated", totalMinor: subtotalMinor + delivery.shippingMinor });
}

// Historical orders keep their original total; never infer that unrecorded
// shipping/tax amounts were zero or silently reprice an existing order.
export function readCheckoutTotals(value: unknown, totalMinor: number): CheckoutTotals | null {
  if (value === undefined || value === null) return null;
  const parsed = checkoutTotalsSchema.safeParse(value);
  if (!parsed.success || parsed.data.totalMinor !== totalMinor) throw new Error("The saved checkout total needs review.");
  return parsed.data;
}
