"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { inventoryRequest } from "@/lib/inventory-client";
import { Button, Badge } from "./ui";
type Order = { id: string; orderNumber: string; status: string; totalMinor: number; expiresAt: string | null; paymentReviewRequired: boolean; checkoutEnabled: boolean; checkoutState: "not_started" | "open" | "processing" | "paid" | "expired" | "unavailable" };
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
      const timer = window.setTimeout(() => { if (active) setMessage("Open the private order link from your checkout confirmation in the same browser. Contact the studio if you no longer have it."); }, 0);
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
    {order && <><Badge>{order.status.replaceAll("_", " ")}</Badge><p>Total: ${(order.totalMinor / 100).toFixed(2)}</p>
      {order.checkoutState === "unavailable" && <p className="notice">We couldn’t verify your payment with Stripe. Please do not pay again. Refresh the order status to retry, or contact the studio.</p>}
      {order.checkoutState === "processing" && <p className="notice">Stripe is still processing your checkout. Please do not pay again. Refresh the order status shortly.</p>}
      {order.status === "pending_payment" && <><p>Stock is held until {order.expiresAt ? new Date(order.expiresAt).toLocaleString() : "the studio closes this request"}. Payment is checked with Stripe when this page loads or you refresh the order status.</p>
        {!order.paymentReviewRequired && ["not_started", "open"].includes(order.checkoutState) && (order.checkoutEnabled ? <><p className="notice">Test checkout only. No real payment is collected. Shipping and tax are not calculated.</p><Button disabled={busy} onClick={() => void act("pay")}>Continue to Stripe test checkout</Button></> : <p>Online payment is not available yet. Contact the studio before the hold expires.</p>)}
        {order.checkoutState === "expired" && <p>Stripe checkout has closed. Contact the studio or cancel this unpaid order.</p>}
        {!order.paymentReviewRequired && ["not_started", "open", "expired"].includes(order.checkoutState) && <Button variant="secondary" disabled={busy} onClick={() => void act("cancel")}>Cancel unpaid order</Button>}</>}
      {order.paymentReviewRequired && <p className="notice">Your payment needs review by the studio. Please do not pay again.</p>}
      {order.status === "paid" && <p>Payment is confirmed. The studio will arrange fulfillment.</p>}
      {["cancelled", "expired"].includes(order.status) && <p>This order no longer holds stock. Contact the studio if a payment was completed.</p>}
    </>}
    <div className="inv-actions"><Button variant="secondary" disabled={busy} onClick={() => void act("status")}>Refresh order status</Button><Link className="inline-link" href="/shop">Back to shop</Link></div>
  </section>;
}
