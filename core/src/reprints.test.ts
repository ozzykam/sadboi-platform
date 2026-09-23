import { expect, it } from "vitest";
import { reprintInputSchema } from "./reprints";
const input = { orderId: "a".repeat(64), variantId: "b".repeat(64), batchId: "c".repeat(64), quantity: 10, reason: "Color drift on first run", status: "requested" };
it("validates reprint requests", () => { expect(reprintInputSchema.safeParse(input).success).toBe(true); expect(reprintInputSchema.safeParse({ ...input, quantity: 0 }).success).toBe(false); expect(reprintInputSchema.safeParse({ ...input, reason: "x" }).success).toBe(false); });
