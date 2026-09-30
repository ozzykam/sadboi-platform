import "server-only";
import { orderIsDue, storePaymentOrderId, readCheckoutTotals } from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId } from "./staff";
import { closePendingOrder, requireOrderToken } from "./order-lifecycle";
import { stripeEnabled } from "./stripe";
import { reconcileStripeCheckout, type CheckoutState } from "./stripe-checkout";
import { readFulfillment } from "./fulfillment";
export async function accessOrder(id: string, body: Record<string, unknown>) {
  if (!storePaymentOrderId.safeParse(id).success || !["status", "cancel"].includes(String(body.action)))
    throw new AccessError(400, "order-access", "Invalid order request.");
  const ref = adminServices().db.doc(`businesses/${businessId}/storeOrders/${id}`);
  let data = (await ref.get()).data();
  if (!data || data.businessId !== businessId) throw new AccessError(404, "order-not-found", "Order access was not found.");
  requireOrderToken(data, body.token);
  let checkoutState: CheckoutState = "not_started";
  try { checkoutState = await reconcileStripeCheckout(id); }
  catch {
    // A provider outage must neither invent a successful payment nor invite a
    // second payment. Keep the private order readable so the customer can retry.
    checkoutState = "unavailable";
    console.error("Stripe order verification unavailable", { orderId: id });
  }
  data = (await ref.get()).data()!;
  if (body.action === "cancel") {
    if (typeof body.operationId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.operationId)) throw new AccessError(400, "order-access", "A cancellation request ID is required.");
    if (["paid", "processing", "unavailable"].includes(checkoutState))
      throw new AccessError(409, "payment-verification", "Payment may already be completed. Refresh the order status before cancelling.");
    await closePendingOrder(id, "cancelled", body.operationId, "customer", "Cancelled by customer", body.token);
  } else if (orderIsDue(data as { status: string; expiresAt?: string })) {
    await closePendingOrder(id, "expired", "expiry:" + id + ":" + data.expiresAt, "expiry", "Payment deadline reached");
  }
  const snapshot = await adminServices().db.runTransaction(async tx => {
    const [order, fulfillment] = await Promise.all([tx.get(ref), tx.get(adminServices().db.doc(`businesses/${businessId}/fulfillments/${id}`))]);
    return { order: order.data()!, fulfillment: fulfillment.data() };
  });
  data = snapshot.order;
  requireOrderToken(data, body.token);
  let fulfillment: { status: string; method: string; trackingNumber: string; updatedAt: string } | null = null;
  try {
    const saved = readFulfillment(snapshot.fulfillment, id);
    if (saved) fulfillment = { status: saved.input.status, method: saved.input.method, trackingNumber: saved.input.method === "pickup" ? "" : saved.input.trackingNumber, updatedAt: saved.updatedAt };
  } catch { /* Historical records needing review do not expose unverified details. */ }
  return { id, orderNumber: String(data.orderNumber), status: String(data.status), totalMinor: Number(data.totalMinor),
    expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : null, paymentReviewRequired: data.paymentReviewRequired === true,
    checkoutEnabled: stripeEnabled(), checkoutState, testMode: true, fulfillment, pricing: readCheckoutTotals(data.pricing, data.totalMinor) };
}
