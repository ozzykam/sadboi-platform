import { expect, it } from "vitest";
import { purchaseOrderInputSchema, purchaseRemaining, receivePurchaseLine, purchaseReceiptSchema, supplierInputSchema, type PurchaseLine } from "./purchasing";
const id = "a".repeat(64);
const input = { variantId: id, quantity: 10, unitCostMinor: 1250, specification: "A3 matte archival print" };
const line: PurchaseLine = { ...input, sku: "TEST-A3", variantName: "A3", productTitle: "Print", accepted: 0, quarantined: 0, rejected: 0, cancelled: 0 };
const order = { supplierId: id, reference: "QUOTE-1", expectedDate: "2026-10-01", notes: "", currency: "USD", lines: [input] };
it("tracks partial quality outcomes against ordered units", () => {
  const received = receivePurchaseLine(line, { accepted: 4, quarantined: 2, rejected: 1 });
  expect(purchaseRemaining(received)).toBe(3);
  expect(received.accepted).toBe(4);
  expect(purchaseRemaining(receivePurchaseLine(received, { accepted: 0, quarantined: 0, rejected: 3 }))).toBe(0);
});
it("rejects delivery beyond the outstanding commitment", () => {
  const partial = receivePurchaseLine(line, { accepted: 9, quarantined: 0, rejected: 0 });
  expect(() => receivePurchaseLine(partial, { accepted: 2, quarantined: 0, rejected: 0 })).toThrow();
  expect(() => receivePurchaseLine({ ...line, cancelled: 10 }, { accepted: 1, quarantined: 0, rejected: 0 })).toThrow();
});
it("rejects empty, negative, and fractional receipts", () => {
  for (const accepted of [0, -1, 1.5, NaN]) expect(() => receivePurchaseLine(line, { accepted, quarantined: 0, rejected: 0 })).toThrow();
});
it("validates order lines, calendar dates, currency, and ownership", () => {
  expect(purchaseOrderInputSchema.safeParse(order).success).toBe(true);
  for (const patch of [{ expectedDate: "2026-02-30" }, { currency: "OTHER" }, { lines: [] }, { lines: [input, input] }, { businessId: "other" }]) expect(purchaseOrderInputSchema.safeParse({ ...order, ...patch }).success).toBe(false);
});
it("rejects excessive totals and fractional unit prices", () => {
  expect(purchaseOrderInputSchema.safeParse({ ...order, lines: [{ ...input, unitCostMinor: 1.5 }] }).success).toBe(false);
  expect(purchaseOrderInputSchema.safeParse({ ...order, lines: [{ ...input, quantity: 1_000_000, unitCostMinor: 100_000_000 }] }).success).toBe(false);
});
it("requires actual receipt outcomes and a reason", () => {
  const receipt = { orderId: id, variantId: id, locationId: id, accepted: 1, quarantined: 0, rejected: 0, reason: "Inspected", reference: "" };
  expect(purchaseReceiptSchema.safeParse(receipt).success).toBe(true);
  for (const patch of [{ accepted: 0 }, { reason: "" }, { actorId: "someone" }, { accepted: 1_000_000, rejected: 1 }]) expect(purchaseReceiptSchema.safeParse({ ...receipt, ...patch }).success).toBe(false);
});
it("validates supplier contact details without assuming a lead time", () => {
  const supplier = { name: "Printer", contactName: "", email: "", phone: "", address: "", capabilities: "", leadTimeDays: null, notes: "", status: "active" };
  expect(supplierInputSchema.safeParse(supplier).success).toBe(true);
  expect(supplierInputSchema.safeParse({ ...supplier, email: "invalid" }).success).toBe(false);
  expect(supplierInputSchema.safeParse({ ...supplier, leadTimeDays: -1 }).success).toBe(false);
});
