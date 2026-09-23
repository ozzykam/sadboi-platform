import { expect, it } from "vitest";
import { storeOrderInputSchema, storeOrderRequestSchema } from "./store-orders";
it("validates public order lines", () => {
  const input = {
    customerName: "Maya",
    customerEmail: "maya@example.com",
    notes: "",
    lines: [{ variantId: "a".repeat(64), quantity: 1 }],
  };
  expect(storeOrderInputSchema.safeParse(input).success).toBe(true);
  expect(storeOrderInputSchema.safeParse({ ...input, lines: [] }).success).toBe(
    false,
  );
});
it("requires a valid request identity and rejects duplicate lines and injected totals", () => {
  const input = {
    customerName: "Maya",
    customerEmail: "maya@example.test",
    notes: "",
    lines: [{ variantId: "a".repeat(64), quantity: 1 }],
  };
  const operationId = "123e4567-e89b-42d3-a456-426614174000";
  expect(
    storeOrderRequestSchema.safeParse({ operationId, input }).success,
  ).toBe(true);
  expect(storeOrderRequestSchema.safeParse({ input }).success).toBe(false);
  expect(
    storeOrderRequestSchema.safeParse({ operationId: "bad", input }).success,
  ).toBe(false);
  expect(
    storeOrderRequestSchema.safeParse({
      operationId,
      input: { ...input, lines: [...input.lines, ...input.lines] },
    }).success,
  ).toBe(false);
  expect(
    storeOrderRequestSchema.safeParse({
      operationId,
      input: { ...input, totalMinor: 1 },
    }).success,
  ).toBe(false);
});
