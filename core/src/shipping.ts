import { z } from "zod";
import type { StoreOrderInput } from "./store-orders";
import type { CheckoutTotals } from "./checkout-totals";

export const usShippingRegions = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
const rate = z.object({ enabled: z.boolean(), amountMinor: z.number().int().min(0).max(1_000_000) }).strict();
export const shippingPolicySchema = z.object({
  standard: rate, express: rate,
  regions: z.array(z.string().refine(value => usShippingRegions.includes(value), "Use a supported US state code.")).max(51),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.regions).size !== value.regions.length || ((value.standard.enabled || value.express.enabled) && !value.regions.length))
    ctx.addIssue({ code: "custom", message: "Choose unique destination states before enabling shipping." });
});
export type ShippingPolicy = z.infer<typeof shippingPolicySchema>;
export type ShippingSettings = { revision: number; input: ShippingPolicy };
export const defaultShippingPolicy: ShippingPolicy = { standard: { enabled: false, amountMinor: 0 }, express: { enabled: false, amountMinor: 0 }, regions: [] };
export const shippingSaveSchema = z.object({ operationId: z.uuid(), expectedRevision: z.number().int().min(0).max(1_000_000_000), input: shippingPolicySchema }).strict();

export function shippingForOrder(input: StoreOrderInput, settings: ShippingSettings): Pick<CheckoutTotals, "deliveryMethod" | "deliveryLabel" | "shippingMinor" | "policyRevision"> {
  if (input.fulfillmentMethod === "pickup") {
    if (input.shippingService) throw new Error("Remove the shipping service when choosing pickup.");
    return { deliveryMethod: "pickup", deliveryLabel: "Studio pickup", shippingMinor: 0, policyRevision: settings.revision };
  }
  const address = input.shippingAddress, method = input.shippingService ?? "standard";
  if (!address || address.country !== "US" || !settings.input.regions.includes(address.region.toUpperCase()) || !/^\d{5}(?:-\d{4})?$/.test(address.postalCode))
    throw new Error("Shipping is unavailable for this destination. Use a supported US state code and ZIP code, or choose studio pickup.");
  if (!settings.input[method].enabled) throw new Error("This shipping service is unavailable. Choose another service or studio pickup.");
  return { deliveryMethod: method, deliveryLabel: method === "standard" ? "Standard shipping" : "Express shipping",
    shippingMinor: settings.input[method].amountMinor, policyRevision: settings.revision };
}
