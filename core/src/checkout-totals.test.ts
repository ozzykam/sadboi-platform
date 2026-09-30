import { expect, it } from "vitest";
import { calculateCheckoutTotals, readCheckoutTotals } from "./checkout-totals";
const delivery = { shippingMinor: 750, deliveryMethod: "standard" as const, deliveryLabel: "Standard shipping", policyRevision: 2 };
it("adds shipping once per order using integer cents and keeps tax explicitly uncalculated", () => {
  const total = calculateCheckoutTotals([{ quantity: 2, priceMinor: 2501 }, { quantity: 1, priceMinor: 999 }], delivery);
  expect(total).toMatchObject({ subtotalMinor: 6001, shippingMinor: 750, totalMinor: 6751, taxMinor: null, taxStatus: "not_calculated" });
  expect(readCheckoutTotals(total, 6751)).toEqual(total);
});
it("rejects fractional/negative amounts, overflow, and a pickup fee", () => {
  for (const priceMinor of [-1, 0.5, Infinity, 100_000_000]) expect(() => calculateCheckoutTotals([{ quantity: 1, priceMinor }], delivery)).toThrow();
  expect(() => calculateCheckoutTotals([{ quantity: 1000, priceMinor: 99_999_999 }], delivery)).toThrow();
  expect(() => calculateCheckoutTotals([{ quantity: 1, priceMinor: 500 }], { ...delivery, deliveryMethod: "pickup" })).toThrow();
  expect(calculateCheckoutTotals([{ quantity: 1, priceMinor: 500 }], { ...delivery, deliveryMethod: "pickup", shippingMinor: 0 }).totalMinor).toBe(500);
});
it("preserves legacy totals without inventing a breakdown and detects mismatched snapshots", () => {
  expect(readCheckoutTotals(undefined, 500)).toBeNull();
  const total = calculateCheckoutTotals([{ quantity: 1, priceMinor: 500 }], delivery);
  expect(() => readCheckoutTotals(total, 1)).toThrow();
  expect(() => readCheckoutTotals({ ...total, shippingMinor: 0 }, total.totalMinor)).toThrow();
});
