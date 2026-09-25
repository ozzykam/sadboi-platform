"use client";
import { useRef, useState } from "react";
import type { StorePaymentEvent } from "@sadboi/core";
import { inventoryRequest, InventoryRequestError } from "@/lib/inventory-client";
import { Button, Input, Textarea } from "./ui";
export function PaymentReviewForm({ event, onSaved }: { event: StorePaymentEvent; onSaved: () => Promise<void> }) {
  const choices = event.input.status === "failed" ? ["dismiss"] : event.source ? [...(event.reason === "late_success" ? ["accept_payment"] : []), "record_refund"] : [];
  const [action, setAction] = useState(choices[0] ?? ""), [notes, setNotes] = useState(""), [reference, setReference] = useState("");
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const attempt = useRef<Record<string, unknown> | null>(null), lock = useRef(false);
  if (!choices.length) return <p className="notice">Historical events without a Stripe account mapping need administrator reconciliation.</p>;
  return <form className="inv-form" onSubmit={async form => {
    form.preventDefault(); if (lock.current) return;
    attempt.current ??= { orderId: event.input.orderId, eventId: event.id, expectedRevision: event.revision ?? 0, operationId: crypto.randomUUID(), action, notes, reference };
    lock.current = true; setBusy(true); setMessage("");
    try { await inventoryRequest("/api/store/payment-review", { method: "POST", body: JSON.stringify(attempt.current) }); await onSaved(); }
    catch (error) {
      const rejected = error instanceof InventoryRequestError && error.status >= 400 && error.status < 500;
      if (rejected) attempt.current = null;
      setUncertain(!rejected); setMessage(rejected ? error.message : "Result unknown. Retry this same resolution before making another change.");
    } finally { lock.current = false; setBusy(false); }
  }}>
    <fieldset disabled={busy || uncertain} className="inv-form">
      <legend>Resolve payment review</legend>
      <label className="field">Resolution<select value={action} onChange={change => setAction(change.target.value)}>{choices.map(choice => <option key={choice} value={choice}>{choice === "accept_payment" ? "Accept late payment and reserve stock" : choice === "record_refund" ? "Verify completed Stripe refund" : "Dismiss failed-payment review"}</option>)}</select></label>
      {action === "record_refund" && <Input label="Completed Stripe refund ID" placeholder="re_…" required value={reference} onChange={change => setReference(change.target.value)} />}
      <Textarea label="Resolution notes" required minLength={10} maxLength={2000} value={notes} onChange={change => setNotes(change.target.value)} />
    </fieldset>
    <p>{action === "accept_payment" ? "Stripe must confirm an unrefunded payment and enough stock must be available. This reopens the order as paid." : action === "record_refund" ? "Complete the full test refund in Stripe first. This verifies the refund; it does not issue one." : "This records your review of a failed payment. Successful payments cannot be dismissed."}</p>
    <Button type="submit" disabled={busy}>{uncertain ? "Retry same resolution" : "Save review resolution"}</Button>
    {message && <p className="notice" role="status">{message}</p>}
  </form>;
}
