import { expect, it } from "vitest";
import { paymentInputSchema } from "./payments";
const input = { billId: "a".repeat(64), amountMinor: 89650, method: "bank_transfer", reference: "TX-1", status: "settled", paymentDate: "2026-09-21", notes: "" };
it("validates payment attempts", () => { expect(paymentInputSchema.safeParse(input).success).toBe(true); expect(paymentInputSchema.safeParse({ ...input, amountMinor: 0 }).success).toBe(false); expect(paymentInputSchema.safeParse({ ...input, method: "crypto" }).success).toBe(false); });
