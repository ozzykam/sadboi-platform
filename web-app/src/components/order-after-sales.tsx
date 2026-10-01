"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { orderRefundRequestSchema, receivedReturnSchema, type OrderRefundRequest, type ReceivedReturn } from "@sadboi/core";
import type { orderAfterSales } from "@/server/store-after-sales";
import { inventoryRequest, InventoryRequestError } from "@/lib/inventory-client";
import { Button, Input, Textarea, Badge } from "./ui";
type History = Awaited<ReturnType<typeof orderAfterSales>>;
type Attempt = ({ action: "refund" } & OrderRefundRequest) | ({ action: "receive" } & ReceivedReturn);
const money = (value: number) => `$${(value / 100).toFixed(2)}`;
export function OrderAfterSales({ orderId, canEdit }: { orderId: string; canEdit: boolean }) {
  const [history, setHistory] = useState<History | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [amount, setAmount] = useState(""), [reason, setReason] = useState(""), [variantId, setVariant] = useState(""), [quantity, setQuantity] = useState("1");
  const [disposition, setDisposition] = useState<ReceivedReturn["disposition"]>("quarantine"), [locationId, setLocation] = useState(""), [notes, setNotes] = useState("");
  const [pending, setPending] = useState<Attempt | null>(null), lock = useRef(false);
  const key = "sadboi-after-sales:" + orderId;
  function remember(attempt: Attempt | null) {
    setPending(attempt);
    try { if (attempt) sessionStorage.setItem(key, JSON.stringify(attempt)); else sessionStorage.removeItem(key); } catch { /* In-memory recovery still works. */ }
  }
  async function load() {
    const result: History = await inventoryRequest(`/api/store/after-sales?orderId=${orderId}`); setHistory(result);
    setVariant(current => current || result.lines[0]?.variantId || "");
    setLocation(current => current || result.locations[0]?.id || "");
  }
  async function refresh(provider = false) {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage("");
    try {
      if (!history) {
        try {
          const stored = JSON.parse(sessionStorage.getItem(key) ?? "null");
          if (stored) {
            const { action, ...input } = stored;
            const parsed = action === "refund" ? orderRefundRequestSchema.safeParse(input) : action === "receive" ? receivedReturnSchema.safeParse(input) : null;
            if (parsed?.success && parsed.data.orderId === orderId) setPending(stored);
          }
        } catch { /* Malformed local recovery data grants no authority. */ }
      }
      if (provider) await inventoryRequest("/api/store/after-sales", { method: "POST", body: JSON.stringify({ action: "refresh", orderId }) });
      await load();
      if (provider) setMessage("Stripe refund status checked. Review the results below.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "History could not load."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function submit(attempt: Attempt) {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage(""); remember(attempt);
    try {
      const result = await inventoryRequest("/api/store/after-sales", { method: "POST", body: JSON.stringify(attempt) });
      remember(null);
      setMessage(attempt.action === "refund" ? `Refund request saved: ${String(result.status).replaceAll("_", " ")}. Inventory was not changed.` : "Return received. Stock was updated for the selected disposition. No refund was issued.");
      if (attempt.action === "refund") { setAmount(""); setReason(""); } else { setQuantity("1"); setNotes(""); }
      try { await load(); } catch { setMessage("Saved, but history could not refresh. Choose Reload returns and refunds."); }
    } catch (error) {
      if (error instanceof InventoryRequestError && ["order-refund", "order-return", "inventory-conflict", "fulfillment-review"].includes(error.code ?? "") && [400, 409].includes(error.status)) remember(null);
      setMessage(error instanceof Error ? error.message : "Result unknown. Retry the same request.");
    } finally { lock.current = false; setBusy(false); }
  }
  function refund(event: React.FormEvent) {
    event.preventDefault(); if (!history || pending) return;
    if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(amount)) { setMessage("Enter a dollar amount with at most two decimal places."); return; }
    const [dollars, cents = ""] = amount.split(".");
    const parsed = orderRefundRequestSchema.safeParse({ orderId, operationId: crypto.randomUUID(), expectedRevision: history.refundState.revision,
      amountMinor: Number(dollars) * 100 + Number(cents.padEnd(2, "0")), reason });
    if (!parsed.success) { setMessage(parsed.error.issues.map(issue => issue.message).join(" ")); return; }
    void submit({ action: "refund", ...parsed.data });
  }
  function receive(event: React.FormEvent) {
    event.preventDefault(); if (!history || pending) return;
    const parsed = receivedReturnSchema.safeParse({ orderId, operationId: crypto.randomUUID(), expectedRevision: history.returnState.revision,
      variantId, quantity: Number(quantity), disposition, locationId: disposition === "discard" ? null : locationId, notes });
    if (!parsed.success) { setMessage(parsed.error.issues.map(issue => issue.message).join(" ")); return; }
    void submit({ action: "receive", ...parsed.data });
  }
  return <section className="inv-panel order-after-sales" aria-label="Returns and refunds">
    <h3>Returns and refunds</h3>
    <p>Refund money and receive physical returns separately. Stripe refunds are test-only. Recording a refund does not cancel fulfillment, restock items or send an email.</p>
    <div className="inv-actions"><Button variant="secondary" disabled={busy} onClick={() => void refresh()}>{history ? "Reload returns and refunds" : "Load returns and refunds"}</Button>
      <Link className="inline-link" href="/admin/how-to#returns-refunds">How to manage returns and refunds</Link></div>
    {message && <p role="status" className="notice">{message}</p>}
    {pending && <div className="notice"><p>A previous request still needs confirmation. Retry it before starting another. Keep this page open if browser storage is unavailable.</p>
      {canEdit && <Button disabled={busy} onClick={() => void submit(pending)}>Retry same {pending.action === "refund" ? "refund" : "return"}</Button>}</div>}
    {history && <>
      <section><h4>Stripe test refunds</h4>
        <p>Original total: {money(history.totalMinor)} · Confirmed refunded: {money(history.refundState.refundedMinor)} · Pending at Stripe: {money(history.refundState.pendingMinor)}</p>
        <p>{history.refundState.checkedAt ? `Last checked: ${new Date(history.refundState.checkedAt).toLocaleString()}` : "Stripe refunds have not been checked yet. The provider balance is verified before issuing a refund."}</p>
        {history.refundState.activeId && <p className="notice">A saved refund request is still processing or needs review. Refresh Stripe refund status; do not submit a new request.</p>}
        {canEdit && history.paymentMapped && <Button variant="secondary" disabled={busy || !!pending} onClick={() => void refresh(true)}>Refresh Stripe refund status</Button>}
        {!history.paymentMapped && <p>This order has no mapped Stripe payment. Resolve payment review before refunding it.</p>}
        {!history.canRefund && <p>Cancel unshipped fulfillment before refunding it, and resolve any payment review flags. Shipped or collected orders can be refunded without a stock change.</p>}
        {canEdit && history.paymentMapped && history.canRefund && <form className="inv-form" onSubmit={refund}>
          <fieldset disabled={busy || !!pending || !!history.refundState.activeId || history.refundState.pendingMinor > 0}>
            <Input label="Refund amount (USD)" inputMode="decimal" required value={amount} onChange={event => setAmount(event.target.value)} />
            <Textarea label="Refund reason (staff only)" required minLength={3} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} />
            <p>Enter the full remaining amount or a partial amount, including any shipping you intend to refund. This submits a test refund to the original payment method.</p>
            <div className="inv-actions"><Button type="submit">Issue Stripe test refund</Button></div>
          </fieldset>
        </form>}
        {!canEdit && <p>Accounting can review history. A super admin issues refunds and receives returns.</p>}
        {history.refunds.length > 0 && <div className="inv-cards">{history.refunds.map(row => <article className="inv-panel" key={row.id}>
          <Badge>{row.status.replaceAll("_", " ")}</Badge><p>{money(row.amountMinor)} · {new Date(row.createdAt).toLocaleString()}</p><p>{row.reason}</p>
          {row.providerId && <p>{row.providerId}</p>}{row.status === "needs_review" && <p>The uncertain request is too old to resubmit automatically. Have the administrator reconcile it with Stripe; do not delete it or issue a replacement.</p>}
        </article>)}</div>}
        {history.refundState.refunds.length > 0 && <details><summary>Verified provider refunds (including dashboard refunds)</summary>
          {history.refundState.refunds.map(row => <p key={row.id}>{row.id} · {money(row.amountMinor)} · {row.status.replaceAll("_", " ")}</p>)}</details>}
      </section>
      <section><h4>Receive returned items</h4><p>Record items only after physically receiving and inspecting them. Quarantined items remain unavailable until released through Inventory. Discarded items do not enter stock.</p>
        {canEdit && history.canReturn && <form className="inv-form" onSubmit={receive}><fieldset disabled={busy || !!pending}>
          <label className="field">Returned item<select value={variantId} onChange={event => setVariant(event.target.value)}>{history.lines.map(line => <option key={line.variantId} value={line.variantId}>{line.sku} — {line.quantity - (history.returnState.quantities[line.variantId] ?? 0)} remaining returnable</option>)}</select></label>
          <Input label="Received quantity" type="number" min={1} max={1000} required value={quantity} onChange={event => setQuantity(event.target.value)} />
          <label className="field">Return disposition<select value={disposition} onChange={event => setDisposition(event.target.value as ReceivedReturn["disposition"])}><option value="quarantine">Quarantine / damaged or awaiting inspection</option><option value="sellable">Return to sellable stock</option><option value="discard">Discard — no stock retained</option></select></label>
          {disposition !== "discard" && <label className="field">Receiving location<select required value={locationId} onChange={event => setLocation(event.target.value)}><option value="">Choose a location</option>{history.locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>}
          <Textarea label="Return inspection notes (staff only)" minLength={3} maxLength={1000} required value={notes} onChange={event => setNotes(event.target.value)} />
          <p>Only stocked products can be restocked in this version. For retained made-to-order items, ask the administrator to reconcile inventory.</p>
          <div className="inv-actions"><Button type="submit">Record received return</Button></div>
        </fieldset></form>}
        {!history.canReturn && <p>Returns become available after dispatch or collection. Unshipped items should be released by cancelling fulfillment.</p>}
        {!history.returns.length && <p>No returned items recorded.</p>}
        <div className="inv-cards">{history.returns.map(row => <article className="inv-panel" key={row.id}><p>{row.quantity} × {row.sku} · {row.disposition}{row.locationName ? ` · ${row.locationName}` : ""}</p><p>{row.notes}</p><p>{new Date(row.createdAt).toLocaleString()}</p></article>)}</div>
      </section>
    </>}
  </section>;
}
