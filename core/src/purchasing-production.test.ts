import { expect, it } from "vitest";
import { purchaseProductionQueue, purchaseProductionSchema, type PurchaseOrderRecord, type PurchaseProductionUpdate } from "./purchasing";

const input = { orderId: "a".repeat(64), variantId: "b".repeat(64), expectedRevision: 1, stage: "in_production", expectedDate: "2026-10-08", note: "Supplier confirmed printing", reference: "CONF-1" };
const update: PurchaseProductionUpdate = { ...input, stage: "in_production", id: "c".repeat(64), sku: "TEST-A3", actorId: "owner", createdAt: "2026-09-18T00:00:00.000Z" };
const order: PurchaseOrderRecord = {
  id: input.orderId, number: "PO-000001", revision: 1, supplierId: "d".repeat(64),
  supplier: { name: "Printer", contactName: "", email: "", phone: "", address: "", capabilities: "", leadTimeDays: null, notes: "", status: "active" },
  reference: "", expectedDate: "2026-10-01", notes: "", currency: "USD", subtotalMinor: 80000,
  lines: [{ variantId: input.variantId, quantity: 100, unitCostMinor: 800, specification: "Matte", sku: "TEST-A3", variantName: "A3", productTitle: "Print", accepted: 55, quarantined: 3, rejected: 2, cancelled: 0 }],
  status: "partially_received", createdAt: update.createdAt, updatedAt: update.createdAt, orderedAt: update.createdAt, closedAt: null, closeReason: "", production: [],
};

it("validates manual milestones, actual dates, revisions, and server-owned fields", () => {
  expect(purchaseProductionSchema.safeParse(input).success).toBe(true);
  expect(purchaseProductionSchema.safeParse({ ...input, expectedDate: "" }).success).toBe(true);
  for (const patch of [{ stage: "approved" }, { expectedDate: "2026-02-30" }, { expectedRevision: 0 }, { note: " " }, { actorId: "other" }, { quantity: 100 }]) {
    expect(purchaseProductionSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  }
});
it("queues only outstanding units on placed orders after all inspection outcomes", () => {
  expect(purchaseProductionQueue([order])[0].outstanding).toBe(40);
  for (const status of ["draft", "received", "cancelled", "closed"] as const) expect(purchaseProductionQueue([{ ...order, status }])).toEqual([]);
  expect(purchaseProductionQueue([{ ...order, lines: [{ ...order.lines[0], accepted: 95 }] }])).toEqual([]);
});
it("uses original expectations until reported and preserves an explicitly unknown forecast", () => {
  expect(purchaseProductionQueue([order])[0]).toMatchObject({ stage: "unreported", expectedDate: "2026-10-01" });
  expect(purchaseProductionQueue([{ ...order, production: [update] }])[0].expectedDate).toBe("2026-10-08");
  expect(purchaseProductionQueue([{ ...order, production: [{ ...update, expectedDate: "" }] }])[0].expectedDate).toBe("");
});
it("sorts known forecasts first and applies progress only to its SKU", () => {
  const lines = [...order.lines, { ...order.lines[0], variantId: "e".repeat(64), sku: "TEST-A4" }];
  const queue = purchaseProductionQueue([{ ...order, expectedDate: "9999-12-31", lines, production: [{ ...update, expectedDate: "" }] }]);
  expect(queue.map(item => item.sku)).toEqual(["TEST-A4", "TEST-A3"]);
  expect(queue[0].stage).toBe("unreported");
  expect(queue[1].stage).toBe("in_production");
  expect(order.expectedDate).toBe("2026-10-01");
});
