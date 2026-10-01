"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { inventoryRequest } from "@/lib/inventory-client";
import { Button, Badge } from "./ui";
import { CheckoutTotalSummary } from "./checkout-totals";
import type { CheckoutTotals } from "@sadboi/core";
type Order = { id: string; orderNumber: string; status: string; totalMinor: number; expiresAt: string | null; paymentReviewRequired: boolean; checkoutEnabled: boolean; checkoutState: "not_started" | "open" | "processing" | "paid" | "expired" | "unavailable";
  fulfillment: { status: string; method: string; trackingNumber: string; updatedAt: string } | null; pricing: CheckoutTotals | null;
  afterSales: { refundedMinor: number; pendingMinor: number; processing: boolean; returnedUnits: number; checkedAt: string | null };
  replacement: { status: string; trackingNumber: string; updatedAt: string } | null };
export function CustomerOrder({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null), [message, setMessage] = useState("Loading your order…"), [busy, setBusy] = useState(false);
  const token = useRef(""), operationId = useRef<string | null>(null), lock = useRef(false);
  useEffect(() => {
    let active = true;
    const fragment = window.location.hash.slice(1), key = "sadboi-order:" + orderId;
    if (/^[a-f0-9]{64}$/.test(fragment)) {
      token.current = fragment;
      try { sessionStorage.setItem(key, fragment); window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch { /* Keep the access link if storage is blocked. */ }
    } else { try { token.current = sessionStorage.getItem(key) ?? ""; } catch { /* Report missing access below. */ } }
    if (!token.current) {
      const timer = window.setTimeout(() => { if (active) setMessage("Open the private link saved at checkout or included in an order email from the studio. You can use that full link in another browser. Contact the studio if you no longer have it."); }, 0);
      return () => { active = false; window.clearTimeout(timer); };
    }
    inventoryRequest(`/api/store/order-access/${orderId}`, { method: "POST", body: JSON.stringify({ token: token.current, action: "status" }) })
      .then(data => { if (active) { setOrder(data); setMessage(""); } })
      .catch(error => { if (active) setMessage(error instanceof Error ? error.message : "Your order could not load."); });
    return () => { active = false; };
  }, [orderId]);
  async function act(action: "status" | "cancel" | "pay") {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      if (action === "pay") {
        // Preserve access across the off-site redirect; a browser with blocked
        // storage can still use the saved private link after returning.
        const result = await inventoryRequest("/api/store/checkout", { method: "POST", body: JSON.stringify({ orderId, token: token.current }) });
        window.location.assign(result.url);
      } else {
        if (action === "cancel") operationId.current ??= crypto.randomUUID();
        setOrder(await inventoryRequest(`/api/store/order-access/${orderId}`, { method: "POST", body: JSON.stringify({ token: token.current, action, ...(action === "cancel" ? { operationId: operationId.current } : {}) }) }));
      }
    } catch (error) {
      // Checkout can finish in another tab between loading this page and clicking
      // Pay. Refresh through the same authorized server verification path.
      if (action === "pay") {
        try {
          const latest: Order = await inventoryRequest(`/api/store/order-access/${orderId}`, { method: "POST", body: JSON.stringify({ token: token.current, action: "status" }) });
          setOrder(latest);
          if (latest.status !== "pending_payment" || latest.paymentReviewRequired || ["paid", "processing", "unavailable"].includes(latest.checkoutState)) return;
        } catch { /* Preserve the original error and allow a manual refresh. */ }
      }
      setMessage(error instanceof Error ? error.message : "The result is unknown. Refresh the order or retry the same action.");
    }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="inv-panel">
    <p className="eyebrow">YOUR STUDIO ORDER</p><h1>{order?.orderNumber ?? "Order details"}</h1>
    {message && <p className="notice" role="status">{message}</p>}
    {order && <><Badge>{order.status.replaceAll("_", " ")}</Badge><CheckoutTotalSummary pricing={order.pricing} totalMinor={order.totalMinor} />
      {order.checkoutState === "unavailable" && <p className="notice">We couldn’t verify your payment with Stripe. Please do not pay again. Refresh the order status to retry, or contact the studio.</p>}
      {order.checkoutState === "processing" && <p className="notice">Stripe is still processing your checkout. Please do not pay again. Refresh the order status shortly.</p>}
      {order.status === "pending_payment" && <><p>Stock is held until {order.expiresAt ? new Date(order.expiresAt).toLocaleString() : "the studio closes this request"}. Payment is checked with Stripe when this page loads or you refresh the order status.</p>
        {!order.paymentReviewRequired && ["not_started", "open"].includes(order.checkoutState) && (order.checkoutEnabled ? <><p className="notice">Test checkout only. No real payment is collected. Tax is not calculated.</p><Button disabled={busy} onClick={() => void act("pay")}>Continue to Stripe test checkout</Button></> : <p>Online payment is not available yet. Contact the studio before the hold expires.</p>)}
        {order.checkoutState === "expired" && <p>Stripe checkout has closed. Contact the studio or cancel this unpaid order.</p>}
        {!order.paymentReviewRequired && ["not_started", "open", "expired"].includes(order.checkoutState) && <Button variant="secondary" disabled={busy} onClick={() => void act("cancel")}>Cancel unpaid order</Button>}</>}
      {order.paymentReviewRequired && <p className="notice">Your payment needs review by the studio. Please do not pay again.</p>}
      {order.afterSales && (order.afterSales.refundedMinor > 0 || order.afterSales.pendingMinor > 0 || order.afterSales.processing || order.afterSales.returnedUnits > 0) && <section aria-label="Returns and refunds">
        <h2>Returns and refunds</h2>
        <p>Confirmed test refunds: ${(order.afterSales.refundedMinor / 100).toFixed(2)}</p>
        {order.afterSales.pendingMinor > 0 && <p>Pending test refunds: ${(order.afterSales.pendingMinor / 100).toFixed(2)}</p>}
        {order.afterSales.processing && <p>A refund request is being processed or reviewed by the studio.</p>}
        {order.afterSales.returnedUnits > 0 && <p>Items received back by the studio: {order.afterSales.returnedUnits}</p>}
        {order.afterSales.checkedAt && <p>Refunds last checked: {new Date(order.afterSales.checkedAt).toLocaleString()}</p>}
        <p>Your original order total is preserved. Contact the studio to discuss a return or refund.</p>
      </section>}
      {order.status === "paid" && <p>Payment is confirmed.{!order.fulfillment || order.fulfillment.status === "unfulfilled" ? " The studio will arrange fulfillment." : ""}</p>}
      {order.fulfillment && <section aria-label="Fulfillment status">
        <h2>{order.fulfillment.status === "packed" ? order.fulfillment.method === "pickup" ? "Ready for pickup" : "Packed for shipping"
          : order.fulfillment.status === "shipped" ? "Shipped" : order.fulfillment.status === "delivered" ? order.fulfillment.method === "pickup" ? "Collected" : "Delivered"
          : order.fulfillment.status === "cancelled" ? "Fulfillment cancelled" : "Preparing your order"}</h2>
        {order.fulfillment.status === "packed" && order.fulfillment.method === "pickup" && <p>Confirm the pickup time and location with the studio before traveling.</p>}
        {order.fulfillment.method !== "pickup" && ["shipped", "delivered"].includes(order.fulfillment.status) && <>
          <p style={{ overflowWrap: "anywhere" }}>{order.fulfillment.trackingNumber ? `Tracking number: ${order.fulfillment.trackingNumber}` : "No tracking number is currently available. Contact the studio for shipping details."}</p>
          <p>This status was recorded by the studio; it is not live carrier tracking.</p>
        </>}
        <p>Last updated: {new Date(order.fulfillment.updatedAt).toLocaleString()}</p>
      </section>}
      {order.replacement && <section aria-label="Replacement shipment"><h2>Replacement shipment</h2>
        <p>{order.replacement.status === "prepared" ? "The studio is preparing your replacement." : `Replacement ${order.replacement.status}.`}</p>
        {["shipped", "delivered"].includes(order.replacement.status) && <p style={{ overflowWrap: "anywhere" }}>Replacement tracking number: {order.replacement.trackingNumber}</p>}
        <p>Last updated: {new Date(order.replacement.updatedAt).toLocaleString()}</p><p>This is a separate shipment at no additional charge. Status is recorded by the studio, not live carrier tracking.</p>
      </section>}
      {["cancelled", "expired"].includes(order.status) && <p>This order no longer holds stock. Contact the studio if a payment was completed.</p>}
    </>}
    <div className="inv-actions"><Button variant="secondary" disabled={busy} onClick={() => void act("status")}>Refresh order status</Button><Link className="inline-link" href="/shop">Back to shop</Link></div>
  </section>;
}
