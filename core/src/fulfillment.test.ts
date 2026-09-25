import { expect, it } from "vitest";
import { fulfillmentInputSchema, fulfillmentEffect, fulfillmentLinesSchema, type FulfillmentInput } from "./fulfillment";
it("validates domestic fulfillment records", () => { const value = { orderId: "a".repeat(32), recipientName: "Maya", address1: "1 Main", address2: "", city: "Chicago", region: "IL", postalCode: "60601", country: "US", method: "standard", trackingNumber: "", status: "unfulfilled", notes: "" }; expect(fulfillmentInputSchema.safeParse(value).success).toBe(true); expect(fulfillmentInputSchema.safeParse({ ...value, country: "CA" }).success).toBe(false); });
const pickup: FulfillmentInput = { orderId: "a".repeat(32), recipientName: "Maya", address1: "", address2: "", city: "", region: "", postalCode: "", country: "US", method: "pickup", trackingNumber: "", status: "packed", notes: "" };
it("allows address-free pickup and cancellation but requires a shipping address", () => {
  expect(fulfillmentInputSchema.safeParse(pickup).success).toBe(true);
  expect(fulfillmentInputSchema.safeParse({ ...pickup, method: "standard" }).success).toBe(false);
  expect(fulfillmentInputSchema.safeParse({ ...pickup, method: "standard", status: "cancelled" }).success).toBe(true);
  expect(fulfillmentInputSchema.safeParse({ ...pickup, status: "shipped" }).success).toBe(false);
});
it("consumes once at dispatch or collection and requires packing first", () => {
  expect(fulfillmentEffect(null, pickup)).toBe("none");
  expect(fulfillmentEffect(pickup, { ...pickup, status: "delivered" })).toBe("consume");
  const packed = { ...pickup, method: "standard" as const }, shipped = { ...packed, status: "shipped" as const };
  expect(fulfillmentEffect(packed, shipped)).toBe("consume");
  expect(fulfillmentEffect(shipped, { ...shipped, status: "delivered" })).toBe("none");
  expect(() => fulfillmentEffect(null, shipped)).toThrow();
  expect(() => fulfillmentEffect(packed, { ...packed, status: "delivered" })).toThrow();
});
it("prevents cancellation after dispatch, reopening terminal states, and changing the dispatched recipient", () => {
  expect(fulfillmentEffect(pickup, { ...pickup, status: "cancelled" })).toBe("release");
  for (const status of ["shipped", "delivered", "cancelled"] as const) {
    const prior = { ...pickup, method: "standard" as const, status };
    expect(() => fulfillmentEffect(prior, { ...prior, status: "cancelled" })).toThrow();
    expect(() => fulfillmentEffect(prior, { ...prior, status: "packed" })).toThrow();
  }
  const shipped = { ...pickup, method: "standard" as const, status: "shipped" as const };
  expect(() => fulfillmentEffect(shipped, { ...shipped, recipientName: "Someone else" })).toThrow();
  expect(fulfillmentEffect(shipped, { ...shipped, trackingNumber: "corrected" })).toBe("none");
});
it("rejects missing, duplicate, excessive, or mismatched allocation snapshots", () => {
  const line = { variantId: "a".repeat(64), quantity: 3, sku: "PRINT", name: "Print", productTitle: "Art", fulfillment: "stocked", allocations: [{ locationId: "b".repeat(64), quantity: 3 }] };
  expect(fulfillmentLinesSchema.safeParse([line]).success).toBe(true);
  for (const invalid of [ [line, line], [{ ...line, allocations: [] }], [{ ...line, allocations: undefined }], [{ ...line, quantity: 2 }], [{ ...line, quantity: 6, allocations: [...line.allocations, ...line.allocations] }], [{ ...line, fulfillment: "made_to_order" }] ])
    expect(fulfillmentLinesSchema.safeParse(invalid).success).toBe(false);
  expect(fulfillmentLinesSchema.safeParse([{ ...line, fulfillment: "made_to_order", allocations: [] }]).success).toBe(true);
});
