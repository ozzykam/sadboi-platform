import { expect, it } from "vitest";
import { quoteEffectiveUnitCost, quoteInputSchema, quoteTotal } from "./quotes";
const id = "a".repeat(64);
const quote = { supplierId: id, variantId: "b".repeat(64), reference: "Q-1", quantity: 100, unitCostMinor: 800, setupCostMinor: 500, shippingCostMinor: 1500, expectedDate: "2026-10-01", expiresDate: "2026-10-15", specification: "A3 matte", status: "received", notes: "" };
it("calculates total and effective unit cost including setup and shipping", () => { expect(quoteTotal(quote)).toBe(82000); expect(quoteEffectiveUnitCost(quote)).toBe(820); });
it("validates quote dates, money, and statuses", () => { expect(quoteInputSchema.safeParse(quote).success).toBe(true); expect(quoteInputSchema.safeParse({ ...quote, expiresDate: "2026-09-01" }).success).toBe(false); expect(quoteInputSchema.safeParse({ ...quote, status: "approved" }).success).toBe(false); expect(quoteInputSchema.safeParse({ ...quote, unitCostMinor: 1.5 }).success).toBe(false); });
