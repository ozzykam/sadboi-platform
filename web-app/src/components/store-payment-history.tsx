"use client";
import { useState } from "react";
import Link from "next/link";
import { paymentEventReasons, type StorePaymentEvent } from "@sadboi/core";
import { inventoryRequest } from "@/lib/inventory-client";
import { Badge, Button } from "./ui";
import { PaymentReviewForm } from "./payment-review-form";

export function StorePaymentHistory({ orderId, canEdit = false, onChanged }: { orderId: string; canEdit?: boolean; onChanged?: () => Promise<void> }) {
  const [events, setEvents] = useState<StorePaymentEvent[] | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function load() {
    if (busy) return;
    setBusy(true); setError("");
    try { setEvents((await inventoryRequest(`/api/store/orders/${orderId}/payment-events`)).events); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Payment history could not load."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="order-payment-history" className="store-payment-history">
    <h3 id="order-payment-history">Payment history</h3>
    <p>Provider reports and their effect on this order. This history does not issue refunds or collect payments.</p>
    <div className="inv-actions">
      <Button variant="secondary" disabled={busy} onClick={load}>{busy ? "Loading payment history…" : events === null ? "Load payment history" : "Refresh payment history"}</Button>
      <Link className="inline-link" href="/admin/how-to#store-payments">How to review payment events</Link>
    </div>
    {error && <p className="notice" role="status">{error}</p>}
    {events?.length === 0 && <p className="notice">No payment events have been received for this order.</p>}
    {events && events.length > 0 && <ul className="store-payment-events">{events.map(event => <li key={event.id}>
      <Badge>{event.resolution ? "Review resolved" : event.outcome === "review" ? "Review required" : event.outcome === "applied" ? "Payment confirmed" : event.outcome === "legacy" ? "Historical event" : "No order change"}</Badge>
      <p>{event.input.provider} reported {event.input.status} · ${(event.input.amountMinor / 100).toFixed(2)} {event.input.currency}</p>
      <p>{paymentEventReasons[event.reason] ?? "Review this provider report with the administrator."}</p>
      <p>Payment: {event.input.paymentId}<br />Event: {event.input.eventId}<br />Received: {event.receivedAt}</p>
      {event.source && <p>Test account: {event.source.accountId}</p>}
      {event.resolution && <p>Resolution: {event.resolution.action.replaceAll("_", " ")} · {event.resolution.createdAt}<br />{event.resolution.notes}{event.resolution.reference && <><br />Reference: {event.resolution.reference}</>}</p>}
      {canEdit && event.outcome === "review" && !event.resolution && <PaymentReviewForm event={event} onSaved={async () => { await load(); await onChanged?.(); }} />}
    </li>)}</ul>}
  </section>;
}
