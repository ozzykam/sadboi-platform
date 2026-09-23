import { expect, it } from "vitest";
import { batchInputSchema } from "./batches";
const input = { orderId: "a".repeat(64), variantId: "b".repeat(64), batchNumber: "B-01", quantity: 100, waste: 2, status: "in_production", notes: "First run" };
it("validates production quantities and statuses", () => { expect(batchInputSchema.safeParse(input).success).toBe(true); expect(batchInputSchema.safeParse({ ...input, waste: 101 }).success).toBe(false); expect(batchInputSchema.safeParse({ ...input, status: "approved" }).success).toBe(false); });
