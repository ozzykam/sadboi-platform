import { expect, it } from "vitest";
import { refundInputSchema } from "./refunds";
const input = { paymentId: "a".repeat(64), amountMinor: 1000, reason: "Duplicate payment returned", status: "requested", refundDate: "2026-09-21", reference: "RF-1" };
it("validates refund requests", () => { expect(refundInputSchema.safeParse(input).success).toBe(true); expect(refundInputSchema.safeParse({ ...input, amountMinor: 0 }).success).toBe(false); expect(refundInputSchema.safeParse({ ...input, reason: "x" }).success).toBe(false); });
