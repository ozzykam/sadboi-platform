import { expect, it } from "vitest";
import { restoreStoreCart } from "./store-cart";

const products = [
  {
    title: "Current print",
    variants: [
      {
        id: "a".repeat(64),
        name: "Large",
        priceMinor: 2500,
        available: 3,
        fulfillment: "stocked",
      },
    ],
  },
];
const line = {
  variantId: "a".repeat(64),
  quantity: 2,
  priceMinor: 1,
  variantName: "Old",
  productTitle: "Old",
};

it("rejects corrupt saved carts and unavailable variants", () => {
  for (const raw of [
    null,
    {},
    "bad",
    [
      null,
      {},
      { ...line, quantity: 0.5 },
      { ...line, quantity: -1 },
      { ...line, variantId: "missing" },
    ],
  ])
    expect(restoreStoreCart(raw, products)).toEqual([]);
});

it("refreshes catalog metadata, caps available quantities, and never mutates old state", () => {
  const frozen = Object.freeze({ ...line });
  const current = Object.freeze([frozen]);
  const result = restoreStoreCart([...current, line], products);
  expect(result).toEqual([
    {
      ...line,
      quantity: 3,
      priceMinor: 2500,
      variantName: "Large",
      productTitle: "Current print",
    },
  ]);
  expect(current[0].quantity).toBe(2);
  expect(restoreStoreCart([...current, line], products)).toEqual(result);
});

it("limits made-to-order quantities and cart size to API limits", () => {
  const many = Array.from({ length: 25 }, (_, index) => ({
    ...products[0].variants[0],
    id: String(index),
    fulfillment: "made_to_order",
    available: 0,
  }));
  const catalog = [{ title: "Print", variants: many }];
  const lines = many.flatMap((variant) => [
    { variantId: variant.id, quantity: 800 },
    { variantId: variant.id, quantity: 800 },
  ]);
  const cart = restoreStoreCart(lines, catalog);
  expect(cart).toHaveLength(20);
  expect(cart.every((entry) => entry.quantity === 1000)).toBe(true);
});
