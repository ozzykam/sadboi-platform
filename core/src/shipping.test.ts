import { expect, it } from "vitest";
import { defaultShippingPolicy, shippingForOrder, shippingPolicySchema } from "./shipping";
import type { StoreOrderInput } from "./store-orders";
const input: StoreOrderInput = { customerName: "Test", customerEmail: "test@example.test", notes: "", fulfillmentMethod: "shipping", lines: [{ variantId: "a".repeat(64), quantity: 1 }], shippingAddress: { country: "US", region: "IL", postalCode: "60601", line1: "1 Test", line2: "", city: "Chicago" } };
const settings = { revision: 3, input: { standard: { enabled: true, amountMinor: 750 }, express: { enabled: true, amountMinor: 1500 }, regions: ["IL"] } };
it("selects one configured rate per order and never charges for studio pickup", () => {
  expect(shippingForOrder(input, settings).shippingMinor).toBe(750);
  expect(shippingForOrder({ ...input, shippingService: "express" }, settings).shippingMinor).toBe(1500);
  expect(shippingForOrder({ ...input, fulfillmentMethod: "pickup" }, { revision: 0, input: defaultShippingPolicy }).shippingMinor).toBe(0);
});
it("rejects disabled services, unsupported destinations, bad ZIP codes and conflicting pickup selections", () => {
  expect(() => shippingForOrder(input, { revision: 0, input: defaultShippingPolicy })).toThrow();
  for (const change of [{ country: "CA" }, { region: "PR" }, { postalCode: "wrong" }]) expect(() => shippingForOrder({ ...input, shippingAddress: { ...input.shippingAddress!, ...change } }, settings)).toThrow();
  expect(() => shippingForOrder({ ...input, fulfillmentMethod: "pickup", shippingService: "express" }, settings)).toThrow();
  expect(() => shippingForOrder(input, { ...settings, input: { ...settings.input, standard: { enabled: false, amountMinor: 750 } } })).toThrow();
});
it("validates staff-entered rates and destination lists", () => {
  expect(shippingPolicySchema.safeParse(defaultShippingPolicy).success).toBe(true);
  expect(shippingPolicySchema.safeParse({ ...settings.input, regions: [] }).success).toBe(false);
  expect(shippingPolicySchema.safeParse({ ...settings.input, regions: ["IL", "IL"] }).success).toBe(false);
  expect(shippingPolicySchema.safeParse({ ...settings.input, express: { enabled: true, amountMinor: -1 } }).success).toBe(false);
});
