import { describe, expect, it } from "vitest";
import { emailRetryDelay, emailRetryIsUnsafe, fulfillmentEmailKind, orderEmailLinkPlaceholder, renderOrderEmail } from "./order-emails";
import type { FulfillmentInput } from "./fulfillment";
import { calculateCheckoutTotals } from "./checkout-totals";
describe("order emails", () => {
  it("shows the frozen items and shipping breakdown without describing uncalculated tax as zero", () => {
    const pricing = calculateCheckoutTotals([{ quantity: 2, priceMinor: 2500 }], { deliveryMethod: "standard", deliveryLabel: "Standard shipping", shippingMinor: 750, policyRevision: 1 });
    const email = renderOrderEmail("order_received", { orderNumber: "SO-TEST", totalMinor: 5750, lines: [], pricing });
    expect(email.text).toContain("Items: $50.00 USD"); expect(email.text).toContain("Standard shipping: $7.50 USD");
    expect(email.html).toContain("Tax: not calculated"); expect(email.text).toContain("Total: $57.50 USD");
  });
  const packed: FulfillmentInput = { orderId: "a".repeat(32), recipientName: "Buyer", address1: "", address2: "", city: "", region: "", postalCode: "", country: "US", method: "pickup", trackingNumber: "", status: "packed", notes: "private" };
  it("notifies meaningful fulfillment transitions, not note edits or repeated saves", () => {
    expect(fulfillmentEmailKind(null, packed)).toBe("pickup_ready");
    expect(fulfillmentEmailKind(packed, { ...packed, notes: "edited" })).toBeNull();
    expect(fulfillmentEmailKind({ ...packed, method: "standard" }, packed)).toBe("pickup_ready");
    expect(fulfillmentEmailKind(packed, { ...packed, method: "standard" })).toBeNull();
    const shipped = { ...packed, method: "standard", status: "shipped" } as const;
    expect(fulfillmentEmailKind(packed, shipped)).toBe("order_shipped");
    expect(fulfillmentEmailKind(shipped, { ...shipped, trackingNumber: "new" })).toBe("tracking_updated");
    expect(fulfillmentEmailKind({ ...shipped, trackingNumber: "old" }, shipped)).toBe("tracking_updated");
    expect(fulfillmentEmailKind(shipped, { ...shipped, status: "delivered" })).toBeNull();
    expect(fulfillmentEmailKind(packed, { ...packed, status: "cancelled" })).toBeNull();
  });
  it("escapes tracking and gives honest pickup and missing-tracking instructions", () => {
    const order = { orderNumber: "SO-123", totalMinor: 100, lines: [], trackingNumber: '<script>&"tracking"</script>' };
    for (const kind of ["order_shipped", "tracking_updated"] as const) {
      const email = renderOrderEmail(kind, order);
      expect(email.html).not.toContain("<script>"); expect(email.html).toContain("&lt;script&gt;");
      expect(email.text).toContain(order.trackingNumber); expect(email.subject).toContain("[TEST]");
      expect(renderOrderEmail(kind, { ...order, trackingNumber: "" }).text).toContain("No tracking number");
    }
    const pickup = renderOrderEmail("pickup_ready", order);
    expect(pickup.text).toContain("Confirm the pickup time and location");
    expect(pickup.text).not.toContain(order.trackingNumber);
  });
  it("escapes catalog HTML and separates order receipt from payment", () => {
    const result = renderOrderEmail("order_received", { orderNumber: "SO-000001", totalMinor: 3001,
      lines: [{ productTitle: '<img src=x onerror="alert(1)">', name: "A&B", quantity: 2 }] });
    expect(result.html).not.toContain("<img"); expect(result.html).toContain("&lt;img");
    expect(result.html).toContain("A&amp;B"); expect(result.text).toContain("$30.01 USD");
    expect(result.text).toContain("not a payment confirmation"); expect(result.html).toContain(orderEmailLinkPlaceholder);
    expect(result.subject).toContain("[TEST]");
  });
  it("labels payment confirmation and strips subject line breaks", () => {
    const result = renderOrderEmail("payment_confirmed", { orderNumber: "SO\r\nBcc: x", totalMinor: 100, lines: [] });
    expect(result.subject).not.toMatch(/[\r\n]/); expect(result.text).toContain("Your payment is confirmed");
  });
  it("bounds backoff and refuses unsafe retries before provider deduplication expires", () => {
    expect(emailRetryDelay(1)).toBe(60_000); expect(emailRetryDelay(99)).toBe(3_600_000);
    const started = "2026-09-30T00:00:00Z", now = Date.parse(started);
    expect(emailRetryIsUnsafe(started, 7, now + 22 * 3_600_000)).toBe(false);
    expect(emailRetryIsUnsafe(started, 1, now + 23 * 3_600_000)).toBe(true);
    expect(emailRetryIsUnsafe(started, 8, now)).toBe(true);
    expect(emailRetryIsUnsafe("invalid", 1, now)).toBe(true);
  });
});
