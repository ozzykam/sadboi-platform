"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { disputeNoteRequestSchema, type DisputeNoteInput, type DisputeNoteRequest } from "@sadboi/core";
import type { orderDisputeHistory } from "@/server/store-disputes";
import { inventoryRequest, InventoryRequestError } from "@/lib/inventory-client";
import { Button, Textarea, Badge } from "./ui";
type History = Awaited<ReturnType<typeof orderDisputeHistory>>;
type Note = DisputeNoteRequest;
const empty: DisputeNoteInput = { plan: "undecided", evidence: "", note: "" };
const label = (value: string) => value.replaceAll("_", " ");
export function OrderDisputes({ orderId, canEdit }: { orderId: string; canEdit: boolean }) {
  const [history, setHistory] = useState<History | null>(null), [selected, setSelected] = useState<string | null>(null);
  const [input, setInput] = useState<DisputeNoteInput>(empty), [pending, setPending] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const lock = useRef(false), key = "sadboi-dispute-note:" + orderId;
  function remember(value: Note | null) {
    setPending(value);
    try { if (value) sessionStorage.setItem(key, JSON.stringify(value)); else sessionStorage.removeItem(key); } catch { /* Retain in-memory retry. */ }
  }
  async function load() {
    const result: History = await inventoryRequest(`/api/store/disputes?orderId=${orderId}`);
    setHistory(result); setSelected(null); setInput(empty);
  }
  async function refresh(provider: boolean) {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage("");
    try {
      if (!history) {
        try {
          const parsed = disputeNoteRequestSchema.safeParse(JSON.parse(sessionStorage.getItem(key) ?? "null"));
          if (parsed.success && parsed.data.orderId === orderId) setPending(parsed.data);
        } catch { /* Ignore malformed local data. */ }
      }
      if (provider) await inventoryRequest("/api/store/disputes", { method: "POST", body: JSON.stringify({ action: "refresh", orderId }) });
      await load();
      if (provider) setMessage("Stripe disputes checked. Review the saved status and response deadline below.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Disputes could not be checked. Saved history is retained."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function save(attempt: Note) {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage(""); remember(attempt);
    try {
      await inventoryRequest("/api/store/disputes", { method: "POST", body: JSON.stringify({ action: "note", ...attempt }) });
      remember(null); setMessage("Private dispute notes saved. No evidence or decision was sent to Stripe.");
      try { await load(); } catch { setMessage("Notes saved, but history could not refresh. Reload dispute history."); }
    } catch (error) {
      if (error instanceof InventoryRequestError && error.status >= 400 && error.status < 500) remember(null);
      setMessage(error instanceof Error ? error.message : "Result unknown. Retry the same dispute note.");
    } finally { lock.current = false; setBusy(false); }
  }
  const editing = history?.rows.find(row => row.id === selected), frozen = busy || !!pending;
  return <section className="inv-panel shipment-case" aria-label="Payment disputes">
    <h3>Payment disputes</h3>
    <p>Track a customer’s card dispute, gather private evidence references, and review Stripe’s response deadline. A dispute is separate from a refund or shipment problem.</p>
    <div className="inv-actions"><Button variant="secondary" disabled={busy} onClick={() => void refresh(false)}>{history ? "Reload dispute history" : "Load payment disputes"}</Button><Link className="inline-link" href="/admin/how-to#payment-disputes">How to manage payment disputes</Link></div>
    {message && <p className="notice" role="status">{message}</p>}
    {pending && <div className="notice"><p>A note save still needs confirmation. Retry its original request before editing again.</p>{canEdit && <Button disabled={busy} onClick={() => void save(pending)}>Retry same dispute note</Button>}</div>}
    {history && <>
      <p>{history.checkedAt ? `Last Stripe check: ${new Date(history.checkedAt).toLocaleString()}` : "Disputes have not been checked for this order yet."}</p>
      {!history.paymentMapped && <p>A confirmed Stripe test payment is required. Unmapped or additional payments need Payment history review.</p>}
      {canEdit && history.paymentMapped && <Button variant="secondary" disabled={frozen} onClick={() => void refresh(true)}>Refresh Stripe disputes</Button>}
      {!canEdit && <p>Accounting can read dispute history. A super admin refreshes Stripe and updates private notes.</p>}
      {history.held && <p className="notice">An open or lost dispute pauses unshipped fulfillment and replacement preparation/dispatch. Cancellation still releases an existing allocation. Review the outcome in Stripe; notes do not remove this hold.</p>}
      {!history.rows.length && <p>{history.checkedAt ? "No disputes were returned at the last Stripe check." : "No saved dispute records."}</p>}
      {history.accountId && <p>Stripe test account: {history.accountId}. Confirm this account and test mode in the <a href="https://dashboard.stripe.com/test/disputes" target="_blank" rel="noreferrer" className="inline-link">Stripe Dashboard</a>.</p>}
      <p>Submit evidence or accept the dispute in Stripe, then refresh here. Saving a response plan below does neither. Do not issue a separate refund for an active chargeback without reviewing it in Stripe.</p>
      {history.rows.map(row => <article key={row.id} className="inv-panel">
        <h4 style={{ overflowWrap: "anywhere" }}>{row.snapshot.id}</h4><Badge>{label(row.snapshot.status)}</Badge>
        <p>Disputed: ${(row.snapshot.amountMinor / 100).toFixed(2)} USD · Reason: {label(row.snapshot.reason)}</p>
        <p>Response deadline: {row.snapshot.dueAt ? new Date(row.snapshot.dueAt).toLocaleString() : "Not supplied by Stripe"}</p>
        {row.snapshot.pastDue && <p className="notice">Stripe marked the response deadline as passed.</p>}
        <p>Evidence saved in Stripe: {row.snapshot.hasEvidence ? "Yes" : "No"} · Submissions: {row.snapshot.submissionCount}</p>
        {row.input && <p>Staff response plan: {row.input.plan === "challenge" ? "Challenge in Stripe" : row.input.plan === "accept" ? "Accept in Stripe" : "Undecided"}. This is a private plan, not a submitted response.</p>}
        {canEdit && <Button variant="secondary" disabled={frozen || row.noteRevision >= 200} onClick={() => { setSelected(row.id); setInput({ plan: row.input?.plan ?? "undecided", evidence: row.input?.evidence ?? "", note: "" }); }}>Update private notes</Button>}
        <details><summary>Stripe status history ({Math.min(row.providerRevision, 30)} of {row.providerRevision})</summary>{row.events.map(event => <p key={event.revision}>#{event.revision} · {label(event.snapshot.status)} · Checked {new Date(event.checkedAt).toLocaleString()}</p>)}</details>
        <details><summary>Private note history ({Math.min(row.noteRevision, 30)} of {row.noteRevision})</summary>{row.notes.map(note => <div key={note.revision}><p>#{note.revision} · {note.input.plan} · {new Date(note.createdAt).toLocaleString()}</p><p className="shipment-evidence">{note.input.note}</p><p className="shipment-evidence">{note.input.evidence}</p></div>)}</details>
      </article>)}
      {canEdit && editing && <form className="inv-form" onSubmit={event => {
        event.preventDefault(); if (frozen) return;
        const parsed = disputeNoteRequestSchema.safeParse({ orderId, id: editing.id, operationId: crypto.randomUUID(), expectedRevision: editing.noteRevision, input });
        if (!parsed.success) { setMessage(parsed.error.issues.map(issue => issue.message).join(" ")); return; }
        void save(parsed.data);
      }}><fieldset disabled={frozen} className="shipment-fields"><legend>Private notes for {editing.snapshot.id}</legend>
        <label className="field">Response plan<select value={input.plan} onChange={e => setInput({ ...input, plan: e.target.value as DisputeNoteInput["plan"] })}><option value="undecided">Undecided</option><option value="challenge">Plan to challenge in Stripe</option><option value="accept">Plan to accept in Stripe</option></select></label>
        <Textarea label="Evidence references (staff only)" maxLength={4000} value={input.evidence} onChange={e => setInput({ ...input, evidence: e.target.value })} />
        <p>Reference existing receipts, delivery records, policies and customer messages kept in secure storage. This form does not upload files or send evidence.</p>
        <Textarea label="Dispute update notes (staff only)" required minLength={3} maxLength={2000} value={input.note} onChange={e => setInput({ ...input, note: e.target.value })} />
        <Button type="submit">Save private dispute notes</Button>
      </fieldset></form>}
      <p>Reloading replaces unsaved edits. Keep the page open after an uncertain save; retry the same note. Histories retain prior entries; this screen shows the latest 30 of each.</p>
    </>}
  </section>;
}
