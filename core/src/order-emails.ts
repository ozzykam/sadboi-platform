import type { FulfillmentInput } from "./fulfillment";
import { readCheckoutTotals, type CheckoutTotals } from "./checkout-totals";

export const orderEmailLabels = {
  order_received: "Order received", payment_confirmed: "Payment confirmed",
  pickup_ready: "Ready for pickup", order_shipped: "Order shipped", tracking_updated: "Tracking updated",
} as const;
export type OrderEmailKind = keyof typeof orderEmailLabels;
export type FulfillmentEmailKind = Extract<OrderEmailKind, "pickup_ready" | "order_shipped" | "tracking_updated">;
export function fulfillmentEmailKind(previous: FulfillmentInput | null, next: FulfillmentInput): FulfillmentEmailKind | null {
  if (next.status === "packed" && next.method === "pickup" && (previous?.status !== "packed" || previous.method !== "pickup")) return "pickup_ready";
  if (next.status === "shipped" && previous?.status !== "shipped") return "order_shipped";
  if (next.status === "shipped" && previous?.trackingNumber !== next.trackingNumber) return "tracking_updated";
  return null;
}
export type OrderEmailSnapshot = {
  orderNumber: string;
  totalMinor: number;
  lines: Array<{ productTitle: string; name: string; quantity: number }>;
  trackingNumber?: string;
  pricing?: CheckoutTotals;
};
export const orderEmailLinkPlaceholder = "{{PRIVATE_ORDER_URL}}";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

// Freeze these rendered templates when the event is queued. A deployment must
// not change the body under a provider idempotency key during a retry.
export function renderOrderEmail(kind: OrderEmailKind, order: OrderEmailSnapshot) {
  const copy: Record<OrderEmailKind, [string, string]> = {
    order_received: ["Your order is with the studio.", "We received your order request. Open your private order page for its current payment status, stock-hold deadline, and payment options. An order request is not a payment confirmation."],
    payment_confirmed: ["Your payment is confirmed.", "The studio has confirmed your payment. Open your private order page for the latest status. The studio will arrange fulfillment."],
    pickup_ready: ["Your order is ready for pickup.", "The studio marked your order ready for collection. Confirm the pickup time and location with the studio before traveling. Open your private order page for the latest status."],
    order_shipped: ["Your order has shipped.", "The studio recorded your parcel as handed to the carrier. Open your private order page for the latest saved status and tracking details. This is a studio update, not a live carrier scan."],
    tracking_updated: ["Your tracking details have changed.", "The studio updated the tracking details for your shipment. Use the latest details below and open your private order page before checking delivery progress."],
  };
  const [heading, detail] = copy[kind];
  const tracking = kind === "order_shipped" || kind === "tracking_updated"
    ? (order.trackingNumber ? `Tracking number: ${order.trackingNumber}` : "No tracking number is currently available. Contact the studio for shipping details.") : null;
  const total = `$${(order.totalMinor / 100).toFixed(2)} USD`;
  const pricing = readCheckoutTotals(order.pricing, order.totalMinor);
  const amounts = pricing ? [`Items: $${(pricing.subtotalMinor / 100).toFixed(2)} USD`, `${pricing.deliveryLabel}: $${(pricing.shippingMinor / 100).toFixed(2)} USD`, "Tax: not calculated (test checkout)"] : [];
  const items = order.lines.map(line => `${line.quantity} × ${line.productTitle} — ${line.name}`);
  const subject = `[TEST] ${orderEmailLabels[kind]} · ${order.orderNumber.replace(/[\r\n]/g, " ")} · Sadboi Studios`;
  const text = ["SADBOI STUDIOS", "TEST ORDER — no real payment was collected.", heading, order.orderNumber, detail, ...items, ...amounts, `Total: ${total}`,
    ...(tracking ? [tracking] : []), "View your order:", orderEmailLinkPlaceholder, "Keep this link private. Anyone with it can view the order status and manage an unpaid order.",
    "If you did not place this order, ignore this email. You have not been subscribed to marketing."].join("\n\n");
  const html = `<div style="max-width:600px;margin:auto;padding:24px;font-family:Arial,sans-serif;line-height:1.6;color:#242424"><p>SADBOI STUDIOS</p><p><strong>TEST ORDER — no real payment was collected.</strong></p><h1>${heading}</h1><h2>${escapeHtml(order.orderNumber)}</h2><p>${detail}</p><ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>${amounts.map(amount => `<p>${escapeHtml(amount)}</p>`).join("")}<p><strong>Total: ${total}</strong></p>${tracking ? `<p>${escapeHtml(tracking)}</p>` : ""}<p><a href="${orderEmailLinkPlaceholder}">View your order</a></p><p>Keep this link private. Anyone with it can view the order status and manage an unpaid order.</p><p>If you did not place this order, ignore this email. You have not been subscribed to marketing.</p></div>`;
  return { subject, text, html };
}

export function emailRetryDelay(attempts: number) {
  return Math.min(60 * 60_000, 60_000 * 2 ** Math.max(0, Math.min(attempts - 1, 6)));
}

// Resend retains idempotency keys for 24 hours. Stop earlier rather than risk
// sending twice after a lost acceptance response or a crashed worker.
export function emailRetryIsUnsafe(firstAttemptAt: string | null, attempts: number, now: number) {
  return attempts >= 8 || (firstAttemptAt !== null && (!Number.isFinite(Date.parse(firstAttemptAt)) || now - Date.parse(firstAttemptAt) >= 23 * 60 * 60_000));
}
