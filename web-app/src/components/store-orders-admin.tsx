"use client";
import { useEffect, useRef, useState } from "react";
import { fulfillmentInputSchema, fulfillmentStatuses, type FulfillmentInput, type FulfillmentRequest } from "@sadboi/core";
import type { storeOrderCatalog } from "@/server/store-orders";
import { Button, Input, Badge, Textarea } from "./ui";
import { inventoryRequest, InventoryRequestError } from "@/lib/inventory-client";
import { StorePaymentHistory } from "./store-payment-history";
import { PendingOrderCancel } from "./pending-order-cancel";
import { OrderEmailHistory } from "./order-email-history";
import { CheckoutTotalSummary } from "./checkout-totals";
type Catalog = Awaited<ReturnType<typeof storeOrderCatalog>>;
type Order = Catalog["orders"][number];
function initialInput(order: Order): FulfillmentInput {
  const address = order.input.shippingAddress;
  return order.fulfillment?.input ?? { orderId: order.id, recipientName: order.input.customerName,
    address1: address?.line1 ?? "", address2: address?.line2 ?? "", city: address?.city ?? "", region: address?.region ?? "",
    postalCode: address?.postalCode ?? "", country: "US", method: order.input.fulfillmentMethod === "pickup" ? "pickup" : order.input.shippingService ?? "standard",
    trackingNumber: "", status: "unfulfilled", notes: "" };
}
export function StoreOrdersAdmin({ initial, canEdit }: { initial: Catalog; canEdit: boolean }) {
  const [orders, setOrders] = useState(initial.orders), [selected, setSelected] = useState<Order | null>(null);
  const [message, setMessage] = useState(""), [refreshing, setRefreshing] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  async function refresh() {
    setRefreshing(true);
    try { const catalog: Catalog = await inventoryRequest("/api/store/orders"); setOrders(catalog.orders); return catalog.orders; }
    finally { setRefreshing(false); }
  }
  if (selected) return <FulfillmentEditor key={selected.id + ":" + reloadVersion + ":" + (selected.fulfillment?.revision ?? 0)} order={selected} canEdit={canEdit}
    onClose={() => setSelected(null)} onReload={async () => {
      const updated = (await refresh()).find(order => order.id === selected.id);
      if (!updated) throw new Error("This order is no longer available.");
      setSelected(updated);
      setReloadVersion(version => version + 1);
    }} onSaved={async () => {
      setMessage("Fulfillment saved."); setSelected(null);
      try { await refresh(); } catch { setMessage("Fulfillment saved, but the order list could not refresh. Choose Refresh orders to load the latest details."); }
    }} />;
  return <section>
    <div className="section-heading"><h1>Customer orders</h1><Button variant="secondary" disabled={refreshing} onClick={async () => {
      try { await refresh(); setMessage("Orders refreshed."); } catch (error) { setMessage(error instanceof Error ? error.message : "Orders could not refresh."); }
    }}>{refreshing ? "Refreshing…" : "Refresh orders"}</Button></div>
    {canEdit && <Button variant="secondary" disabled={refreshing} onClick={async () => {
      setRefreshing(true);
      try {
        const result = await inventoryRequest("/api/store/order-expiry", { method: "POST", body: "{}" });
        await refresh();
        const failures = [...result.results, ...result.cleanupResults].filter((item: { status: string }) => !["expired", "cancelled", "closed"].includes(item.status));
        setMessage(`Expiry check scanned ${result.scanned} orders.${failures.length ? " Some orders need review: " + failures.map((item: { id: string; status: string }) => item.id + " (" + item.status + ")").join(", ") : " Check completed."}`);
      } catch (error) { setMessage(error instanceof Error ? error.message : "Expiry could not run."); }
      finally { setRefreshing(false); }
    }}>Run pending-order expiry check</Button>}
    {message && <p className="notice" role="status">{message}</p>}
    {!canEdit && <p className="notice">Accounting can review orders. A super admin manages fulfillment.</p>}
    {!orders.length && <p className="empty-state">No customer orders yet.</p>}
    <div className="inv-cards">{orders.map(order => <article className="inv-panel" key={order.id}>
      <Badge>{order.status.replaceAll("_", " ")}</Badge>{order.fulfillment && <Badge>{order.fulfillment.input.status}</Badge>}
      <h2>{order.orderNumber}</h2><p>{order.input.customerName} · {order.input.customerEmail}</p>
      <p>{order.lines.map(line => line.quantity + " × " + line.sku).join(", ")} · ${(order.totalMinor / 100).toFixed(2)}</p>
      {order.reviewReason && <p className="notice">Allocation review required.</p>}
      {order.status === "pending_payment" && order.expiresAt && <p>Payment deadline: {order.expiresAt}</p>}
      {order.stripeExpiryPending && <p className="notice">Stripe checkout closure awaits the next expiry check.</p>}
      {order.paymentReviewRequired && <p className="notice">Payment review required. Open the order’s payment history.</p>}
      <Button onClick={() => { setSelected(order); setMessage(""); }}>{canEdit && order.status === "paid" && !order.reviewReason ? "Open fulfillment" : "View order"}</Button>
    </article>)}</div>
  </section>;
}
function FulfillmentEditor({ order, canEdit, onClose, onSaved, onReload }: {
  order: Order; canEdit: boolean; onClose: () => void; onSaved: () => Promise<void>; onReload: () => Promise<void>;
}) {
  const [input, setInput] = useState(() => initialInput(order));
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [conflict, setConflict] = useState(false);
  const attempt = useRef<FulfillmentRequest | null>(null), inFlight = useRef(false);
  const previous = order.fulfillment?.input.status ?? "unfulfilled";
  const editable = canEdit && order.status === "paid" && !order.reviewReason && !["delivered", "cancelled"].includes(previous);
  const frozen = !editable || busy || uncertain || conflict;
  useEffect(() => {
    if (!uncertain && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [uncertain, busy]);
  function change<K extends keyof FulfillmentInput>(key: K, value: FulfillmentInput[K]) { setInput(current => ({ ...current, [key]: value })); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || !editable || conflict) return;
    if (!attempt.current) {
      const parsed = fulfillmentInputSchema.safeParse(input);
      if (!parsed.success) { setMessage(parsed.error.issues.map(issue => issue.message).join(" ")); return; }
      attempt.current = { input: parsed.data, expectedRevision: order.fulfillment?.revision ?? 0, operationId: crypto.randomUUID() };
    }
    inFlight.current = true; setBusy(true); setMessage("");
    try {
      await inventoryRequest("/api/store/fulfillment", { method: "POST", body: JSON.stringify(attempt.current) });
      attempt.current = null; setUncertain(false); await onSaved();
    } catch (error) {
      if (error instanceof InventoryRequestError && error.status >= 400 && error.status < 500) {
        attempt.current = null; setUncertain(false); setConflict(error.status === 409);
        setMessage(error.message);
      } else {
        setUncertain(true); setMessage("The save result is unknown. Keep this page open and choose Retry same save to recover its result. Details stay locked so stock cannot move twice. If you close the page, inspect the saved order before making another change.");
      }
    } finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="inv-panel">
    <div className="section-heading"><h2>Order {order.orderNumber}</h2><Button variant="ghost" disabled={busy || uncertain} onClick={onClose}>Close</Button></div>
    <p>{order.input.customerName} · {order.input.customerEmail}</p>
    <p>{order.lines.map(line => `${line.quantity} × ${line.sku}${line.fulfillment === "made_to_order" ? " (made to order)" : ""}`).join(", ")}</p>
    {order.input.notes && <p>Customer notes: {order.input.notes}</p>}
    <p>Order: {order.status.replaceAll("_", " ")} · Fulfillment: {previous}</p>
    <CheckoutTotalSummary pricing={order.pricing} totalMinor={order.totalMinor} />
    {order.pricing && <p>Fulfillment changes do not recalculate the saved shipping charge or collect or refund a difference. Arrange any change with the customer separately.</p>}
    {order.fulfillment && <p>Last saved: {order.fulfillment.updatedAt}</p>}
    {order.reviewReason && <p className="notice" role="status">{order.reviewReason}</p>}
    {order.paymentReviewRequired && <p className="notice" role="status">Payment review required. Compare the reports below with the provider before taking further action. No automatic refund has been issued.</p>}
    {order.status === "pending_payment" && <p className="notice">Fulfillment opens after payment is confirmed.</p>}
    {message && <p className="notice" role="status">{message}</p>}
    {conflict && <Button variant="secondary" disabled={busy} onClick={async () => {
      setBusy(true); try { await onReload(); setConflict(false); setMessage("Latest saved order loaded."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not reload the order."); } finally { setBusy(false); }
    }}>Reload saved order</Button>}
    {order.status === "pending_payment" && canEdit && <PendingOrderCancel orderId={order.id} onSaved={onReload} />}
    <StorePaymentHistory orderId={order.id} canEdit={canEdit} onChanged={onReload} />
    <OrderEmailHistory orderId={order.id} canEdit={canEdit} />
    <form onSubmit={save} className="inv-form">
      <fieldset disabled={frozen} className="inv-form" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend>Fulfillment details</legend>
        <label className="field">Method<select value={input.method} disabled={previous === "shipped"} onChange={event => {
          const method = event.target.value as FulfillmentInput["method"];
          setInput(current => ({ ...current, method, status: fulfillmentStatuses(previous, method).includes(current.status) ? current.status : previous }));
        }}><option value="pickup">Studio pickup</option><option value="standard">Standard shipping</option><option value="express">Express shipping</option></select></label>
        <Input label="Recipient" required maxLength={160} value={input.recipientName} readOnly={previous === "shipped"} onChange={event => change("recipientName", event.target.value)} />
        {input.method !== "pickup" && <>
          {([ ["address1", "Address", 200], ["address2", "Address line 2", 200], ["city", "City", 120], ["region", "State", 120], ["postalCode", "Postal code", 40] ] as const).map(([key, label, maxLength]) =>
            <Input key={key} label={label} maxLength={maxLength} required={key !== "address2" && input.status !== "cancelled"} value={input[key]} readOnly={previous === "shipped"} onChange={event => change(key, event.target.value)} />)}
          <p>Country: United States</p><Input label="Tracking number" maxLength={160} value={input.trackingNumber} onChange={event => change("trackingNumber", event.target.value)} />
        </>}
        <label className="field">Status<select value={input.status} onChange={event => change("status", event.target.value as FulfillmentInput["status"])}>
          {(editable ? fulfillmentStatuses(previous, input.method) : [input.status]).map(status => <option key={status} value={status}>{status === "delivered" && input.method === "pickup" ? "Collected by customer" : status[0].toUpperCase() + status.slice(1)}</option>)}
        </select></label>
        <Textarea label="Fulfillment notes" maxLength={2000} value={input.notes} onChange={event => change("notes", event.target.value)} />
      </fieldset>
      {editable && <p>Pack every item before dispatch or collection. Made-to-order items must be ready; this does not schedule production. Shipping or collection consumes the order’s allocated stock once.</p>}
      {editable && <p>Saving Packed for Studio pickup creates a ready-for-pickup email preview. Saving Shipped or changing tracking on a shipped order creates a shipping update. Sending follows the studio email setting; check Order emails after saving. Fulfillment notes stay private.</p>}
      {(input.status === "cancelled" || order.status === "cancelled") && <p className="notice">Cancellation releases this order’s stock allocation. It does not refund a payment. Arrange and record any refund separately.</p>}
      {editable && <Button type="submit" loading={busy} disabled={conflict}>{uncertain ? "Retry same save" : "Save fulfillment"}</Button>}
    </form>
  </section>;
}
