import { expect, it } from "vitest";
import { paymentConfirmationSchema } from "./store-payments";
it("validates provider payment confirmation payloads", () => { const payload = { eventId: "evt_12345678", orderId: "a".repeat(32), provider: "stripe", paymentId: "pi_123", amountMinor: 5000, currency: "USD", status: "succeeded" }; expect(paymentConfirmationSchema.safeParse(payload).success).toBe(true); expect(paymentConfirmationSchema.safeParse({ ...payload, currency: "EUR" }).success).toBe(false); });
