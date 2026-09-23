import { expect, it } from "vitest";
import { fulfillmentInputSchema } from "./fulfillment";
it("validates domestic fulfillment records", () => { const value = { orderId: "a".repeat(32), recipientName: "Maya", address1: "1 Main", address2: "", city: "Chicago", region: "IL", postalCode: "60601", country: "US", method: "standard", trackingNumber: "", status: "unfulfilled", notes: "" }; expect(fulfillmentInputSchema.safeParse(value).success).toBe(true); expect(fulfillmentInputSchema.safeParse({ ...value, country: "CA" }).success).toBe(false); });
