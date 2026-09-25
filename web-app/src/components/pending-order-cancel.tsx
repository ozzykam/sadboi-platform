"use client";
import { useRef, useState } from "react";
import { inventoryRequest, InventoryRequestError } from "@/lib/inventory-client";
import { Button, Input } from "./ui";
export function PendingOrderCancel({ orderId, onSaved }: { orderId: string; onSaved: () => Promise<void> }) {
  const [reason, setReason] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const attempt = useRef<{ orderId: string; operationId: string; reason: string } | null>(null), lock = useRef(false);
  return <form className="inv-form" onSubmit={async event => {
    event.preventDefault(); if (lock.current) return;
    attempt.current ??= { orderId, operationId: crypto.randomUUID(), reason };
    lock.current = true; setBusy(true);
    try { await inventoryRequest("/api/store/order-cancel", { method: "POST", body: JSON.stringify(attempt.current) }); await onSaved(); }
    catch (error) {
      const rejected = error instanceof InventoryRequestError && error.status >= 400 && error.status < 500;
      if (rejected) attempt.current = null;
      setUncertain(!rejected); setMessage(rejected ? error.message : "Result unknown. Retry the same cancellation to recover its result.");
    } finally { lock.current = false; setBusy(false); }
  }}>
    <h3>Cancel unpaid order</h3><p>This releases its stock hold. A payment that arrives afterward will require review.</p>
    <Input label="Cancellation reason" required minLength={3} maxLength={1000} value={reason} disabled={busy || uncertain} onChange={event => setReason(event.target.value)} />
    <Button variant="secondary" disabled={busy} type="submit">{uncertain ? "Retry same cancellation" : "Cancel unpaid order"}</Button>
    {message && <p className="notice" role="status">{message}</p>}
  </form>;
}
