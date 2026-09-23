import { expect, it } from "vitest";
import { reconcileStock, replenishmentNeed, stockCountInputSchema, stockPolicyInputSchema } from "./inventory";

const balance = { variantId: "a".repeat(64), locationId: "b".repeat(64), onHand: 10, reserved: 2, allocated: 1, unavailable: 2, revision: 3 };

it("records shortages and excess units without changing commitments", () => {
  expect(reconcileStock(balance, 7)).toEqual({ ...balance, onHand: 7, revision: 4 });
  expect(reconcileStock(balance, 13)).toEqual({ ...balance, onHand: 13, revision: 4 });
});
it("records matching and zero counts as new observations", () => {
  expect(reconcileStock(balance, 10).revision).toBe(4);
  expect(reconcileStock({ ...balance, reserved: 0, allocated: 0, unavailable: 0 }, 0).onHand).toBe(0);
});
it("rejects counts below stock commitments or quarantine", () => {
  expect(() => reconcileStock(balance, 4)).toThrow(/Reconcile/);
  expect(reconcileStock(balance, 5).onHand).toBe(5);
});
it("rejects fractional, negative, and out-of-range counts", () => {
  for (const count of [-1, 1.5, NaN, Infinity, 1_000_000_001]) expect(() => reconcileStock(balance, count)).toThrow();
});
it("counts available units rather than physical units for replenishment", () => {
  expect(replenishmentNeed(balance, { minimum: 5, target: 12, enabled: true })).toEqual({ available: 5, suggested: 7 });
  expect(replenishmentNeed(balance, { minimum: 4, target: 12, enabled: true })).toBeNull();
});
it("supports an empty-location threshold and disabled monitoring", () => {
  const empty = { ...balance, onHand: 0, reserved: 0, allocated: 0, unavailable: 0 };
  expect(replenishmentNeed(empty, { minimum: 0, target: 10, enabled: true })).toEqual({ available: 0, suggested: 10 });
  expect(replenishmentNeed(empty, { minimum: 0, target: 10, enabled: false })).toBeNull();
});
it("requires a target above a nonnegative integer threshold", () => {
  const input = { variantId: balance.variantId, locationId: balance.locationId, minimum: 0, target: 10, enabled: true, expectedRevision: 0 };
  expect(stockPolicyInputSchema.safeParse(input).success).toBe(true);
  for (const patch of [{ minimum: -1 }, { minimum: 1.5 }, { target: 0 }, { minimum: 10 }, { target: 1_000_001 }, { businessId: "other" }]) {
    expect(stockPolicyInputSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  }
});
it("requires count reasons and rejects supplied ownership or stock deltas", () => {
  const input = { variantId: balance.variantId, locationId: balance.locationId, countedOnHand: 0, expectedRevision: 0, reason: "Opening count", reference: "" };
  expect(stockCountInputSchema.safeParse(input).success).toBe(true);
  for (const patch of [{ reason: "" }, { expectedRevision: -1 }, { quantity: 2 }, { businessId: "other" }, { countedOnHand: 2.3 }]) {
    expect(stockCountInputSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  }
});
