import { expect, it } from "vitest";
import { vendorBillInputSchema, vendorBillTotal } from "./finance";
const input = { supplierId: "a".repeat(64), purchaseOrderId: "b".repeat(64), invoiceNumber: "INV-1", invoiceDate: "2026-09-21", dueDate: "2026-10-21", currency: "USD", subtotalMinor: 80000, shippingMinor: 1500, taxMinor: 8150, status: "received", notes: "" };
it("calculates and validates vendor bills", () => { expect(vendorBillTotal(input)).toBe(89650); expect(vendorBillInputSchema.safeParse(input).success).toBe(true); expect(vendorBillInputSchema.safeParse({ ...input, dueDate: "2026-09-01" }).success).toBe(false); });
