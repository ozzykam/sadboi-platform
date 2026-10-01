"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { shipmentCaseRequestSchema, replacementRequestSchema, type ShipmentCaseInput, type ShipmentCaseRequest, type ReplacementRequest, type ReplacementStatus } from "@sadboi/core";
import type { shipmentCaseHistory } from "@/server/shipment-cases";
import { inventoryRequest, InventoryRequestError } from "@/lib/inventory-client";
import { Button, Input, Textarea, Badge } from "./ui";
type History = Awaited<ReturnType<typeof shipmentCaseHistory>>;
type Attempt = { route: "shipment-cases"; body: ShipmentCaseRequest } | { route: "replacements"; body: ReplacementRequest };
const empty: ShipmentCaseInput = { kind: "damaged", status: "open", items: [], carrier: "", claimReference: "", evidence: "", note: "", resolution: null, refundId: null, returnId: null };
const resolutionLabels = { refund: "Refund issued", replacement: "Replacement sent", located: "Shipment located", no_refund: "Closed without refund or replacement" };
export function ShipmentCase({ orderId, canEdit }: { orderId: string; canEdit: boolean }) {
  const [history, setHistory] = useState<History | null>(null), [input, setInput] = useState<ShipmentCaseInput>(empty);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [pending, setPending] = useState<Attempt | null>(null);
  const [locations, setLocations] = useState<Record<string, string>>({}), [replacementNote, setReplacementNote] = useState("");
  const [tracking, setTracking] = useState(""), [replacementStatus, setReplacementStatus] = useState<ReplacementStatus>("shipped");
  const lock = useRef(false), key = "sadboi-shipment-case:" + orderId;
  const activeReplacement = history?.replacements.find(row => row.status !== "cancelled");
  function remember(attempt: Attempt | null) {
    setPending(attempt);
    try { if (attempt) sessionStorage.setItem(key, JSON.stringify(attempt)); else sessionStorage.removeItem(key); } catch { /* Keep in-memory retry. */ }
  }
  async function load() {
    const result: History = await inventoryRequest(`/api/store/shipment-cases?orderId=${orderId}`);
    setHistory(result); setInput(result.current ? { ...result.current.input, note: "" } : { ...empty, items: [] });
    const replacement = result.replacements.find(row => row.status !== "cancelled");
    setTracking(replacement?.trackingNumber ?? ""); setReplacementStatus(replacement?.status === "shipped" ? "delivered" : "shipped");
    setReplacementNote("");
  }
  async function refresh() {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage("");
    try {
      if (!history) {
        try {
          const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
          const parsed = saved?.route === "shipment-cases" ? shipmentCaseRequestSchema.safeParse(saved.body) : saved?.route === "replacements" ? replacementRequestSchema.safeParse(saved.body) : null;
          if (parsed?.success && parsed.data.orderId === orderId) setPending(saved);
        } catch { /* Invalid local data is ignored; server authorizes every request. */ }
      }
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Shipment case could not load."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function submit(attempt: Attempt) {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage(""); remember(attempt);
    try {
      await inventoryRequest(`/api/store/${attempt.route}`, { method: "POST", body: JSON.stringify(attempt.body) });
      remember(null); setMessage(attempt.route === "shipment-cases" ? "Shipment case saved. No money or stock changed." : "Replacement saved. Review its status and stock history below. No additional payment was collected.");
      try { await load(); } catch { setMessage("Saved, but history could not refresh. Choose Reload shipment case."); }
    } catch (error) {
      if (error instanceof InventoryRequestError && error.status >= 400 && error.status < 500) remember(null);
      setMessage(error instanceof Error ? error.message : "Result unknown. Retry the same request.");
    } finally { lock.current = false; setBusy(false); }
  }
  function saveCase(event: React.FormEvent) {
    event.preventDefault(); if (!history || pending) return;
    const parsed = shipmentCaseRequestSchema.safeParse({ orderId, expectedRevision: history.current?.revision ?? 0, operationId: crypto.randomUUID(), input });
    if (!parsed.success) { setMessage(parsed.error.issues.map(issue => issue.message).join(" ")); return; }
    void submit({ route: "shipment-cases", body: parsed.data });
  }
  function saveReplacement(event: React.FormEvent) {
    event.preventDefault(); if (!history?.current || pending) return;
    const common = { orderId, operationId: crypto.randomUUID(), note: replacementNote };
    const parsed = replacementRequestSchema.safeParse(activeReplacement ? { ...common, action: "update", replacementId: activeReplacement.id, expectedRevision: activeReplacement.revision, status: replacementStatus, trackingNumber: tracking } :
      { ...common, action: "prepare", expectedCaseRevision: history.current.revision, items: history.current.input.items.map(item => ({ ...item, locationId: history.lines.find(line => line.variantId === item.variantId)?.fulfillment === "stocked" ? locations[item.variantId] ?? "" : null })) });
    if (!parsed.success) { setMessage(parsed.error.issues.map(issue => issue.message).join(" ")); return; }
    void submit({ route: "replacements", body: parsed.data });
  }
  const frozen = busy || !!pending;
  return <section className="inv-panel shipment-case" aria-label="Shipment problems and replacements">
    <h3>Shipment problems and replacements</h3>
    <p>Track damage or loss after dispatch. Case notes stay private. Use Returns and refunds above to issue money back or record items physically received.</p>
    <div className="inv-actions"><Button variant="secondary" disabled={busy} onClick={() => void refresh()}>{history ? "Reload shipment case" : "Load shipment case"}</Button><Link className="inline-link" href="/admin/how-to#shipment-cases">How to manage shipment problems</Link></div>
    {message && <p role="status" className="notice">{message}</p>}
    {pending && <div className="notice"><p>A save still needs confirmation. Retry the same request before starting another.</p>{canEdit && <Button disabled={busy} onClick={() => void submit(pending)}>Retry same shipment save</Button>}</div>}
    {history && <>
      {!history.eligible && <p>Shipment cases become available after a shipping order is dispatched. Pickup and unshipped orders use returns or cancellation.</p>}
      <p>Original tracking: {history.trackingNumber || "Not recorded"}</p>
      {history.current && <p><Badge>{history.current.input.kind}</Badge> <Badge>{history.current.input.status}</Badge> Last case update: {new Date(history.current.updatedAt).toLocaleString()}</p>}
      {canEdit && history.eligible && <form className="inv-form" onSubmit={saveCase}><fieldset disabled={frozen} className="shipment-fields">
        <label className="field">Problem<select value={input.kind} onChange={e => setInput({ ...input, kind: e.target.value as ShipmentCaseInput["kind"], resolution: null, refundId: null, status: input.status === "resolved" ? "investigating" : input.status })}><option value="damaged">Damaged shipment</option><option value="lost">Lost shipment</option></select></label>
        <p>Affected quantities (enter 0 for unaffected items):</p>
        {history.lines.map(line => <Input key={line.variantId} label={`${line.sku} — affected quantity (up to ${line.quantity})`} type="number" min={0} max={line.quantity} required value={input.items.find(item => item.variantId === line.variantId)?.quantity ?? 0} onChange={e => setInput({ ...input, items: [...input.items.filter(item => item.variantId !== line.variantId), ...(Number(e.target.value) > 0 ? [{ variantId: line.variantId, quantity: Number(e.target.value) }] : [])] })} />)}
        <Input label="Carrier (optional)" maxLength={120} value={input.carrier} onChange={e => setInput({ ...input, carrier: e.target.value })} />
        <Input label="Carrier claim reference (optional)" maxLength={160} value={input.claimReference} onChange={e => setInput({ ...input, claimReference: e.target.value })} />
        <Textarea label="Evidence references (staff only)" maxLength={2000} value={input.evidence} onChange={e => setInput({ ...input, evidence: e.target.value })} />
        <p>Record references to photos, customer messages or carrier reports kept in your existing secure storage. This form does not upload files or submit carrier claims.</p>
        <label className="field">Case status<select value={input.status} onChange={e => setInput({ ...input, status: e.target.value as ShipmentCaseInput["status"], resolution: null, refundId: null })}>
          {!history.current ? <option value="open">Open</option> : <><option value="open" disabled={history.current.input.status === "resolved"}>Open</option><option value="investigating">Investigating / reopen</option><option value="resolved">Resolved</option></>}
        </select></label>
        {input.status === "resolved" && <label className="field">Resolution<select required value={input.resolution ?? ""} onChange={e => setInput({ ...input, resolution: e.target.value as ShipmentCaseInput["resolution"], refundId: null })}>
          <option value="" disabled>Choose a resolution</option>{Object.entries(resolutionLabels).filter(([value]) => value !== "located" || input.kind === "lost").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>}
        {input.resolution === "refund" && <label className="field">Confirmed refund<select required value={input.refundId ?? ""} onChange={e => setInput({ ...input, refundId: e.target.value || null })}><option value="">Choose a successful refund</option>{history.refunds.map(row => <option key={row.id} value={row.id}>${(row.amountMinor / 100).toFixed(2)} · {row.providerId}</option>)}</select></label>}
        <label className="field">Received return (optional)<select value={input.returnId ?? ""} onChange={e => setInput({ ...input, returnId: e.target.value || null })}><option value="">No linked return</option>{history.returns.map(row => <option key={row.id} value={row.id}>{row.quantity} × {row.sku} · {row.disposition}</option>)}</select></label>
        <Textarea label="Case update / resolution notes (staff only)" required minLength={3} maxLength={2000} value={input.note} onChange={e => setInput({ ...input, note: e.target.value })} />
        <p>Explain partial refunds and any customer agreement. Resolving a case changes no money, stock or original delivery status. Reload the case after issuing a refund or recording a return to select it here.</p>
        <div className="inv-actions"><Button type="submit">Save shipment case</Button></div>
      </fieldset></form>}
      {!canEdit && <p>Accounting can review case and replacement history. A super admin makes changes.</p>}
      <h4>Replacement shipment</h4>
      <p>One replacement shipment per order, covering all affected case items. Prepare reserves fresh sellable stock; dispatch consumes it once. Cancellation before dispatch releases the allocation. No additional payment or email is sent.</p>
      {canEdit && history.current && ((!activeReplacement && history.current.input.status !== "resolved") || activeReplacement?.status === "prepared" || activeReplacement?.status === "shipped") && <form className="inv-form" onSubmit={saveReplacement}><fieldset disabled={frozen} className="shipment-fields">
        {!activeReplacement ? <>
          <p>The replacement ships to the original fulfillment address. Verify that address before preparing. Save case quantity changes first. Made-to-order items must be ready before dispatch; no tracked stock is invented for them.</p>
          {history.destination && <p>Ship to: {history.destination.recipientName}, {history.destination.address1} {history.destination.address2}, {history.destination.city}, {history.destination.region} {history.destination.postalCode}</p>}
          {history.current.input.items.map(item => { const line = history.lines.find(row => row.variantId === item.variantId)!; return line.fulfillment === "stocked" ? <label className="field" key={item.variantId}>Stock location for {item.quantity} × {line.sku}<select required value={locations[item.variantId] ?? ""} onChange={e => setLocations({ ...locations, [item.variantId]: e.target.value })}><option value="">Choose a location</option>{history.locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label> : <p key={item.variantId}>{item.quantity} × {line.sku} (made to order)</p>; })}
        </> : <>
          <p>Replacement status: {activeReplacement.status}. Confirm all replacement items are packed before choosing Shipped.</p>
          <label className="field">Replacement status<select value={replacementStatus} onChange={e => setReplacementStatus(e.target.value as ReplacementStatus)}>{activeReplacement.status === "prepared" ? <><option value="shipped">Shipped</option><option value="cancelled">Cancelled</option></> : <><option value="shipped">Shipped — update tracking</option><option value="delivered">Delivered</option></>}</select></label>
          <Input label="Replacement tracking number" required={replacementStatus !== "cancelled"} maxLength={160} value={tracking} onChange={e => setTracking(e.target.value)} />
        </>}
        <Textarea label="Replacement notes (staff only)" required minLength={3} maxLength={2000} value={replacementNote} onChange={e => setReplacementNote(e.target.value)} />
        <div className="inv-actions"><Button type="submit">{activeReplacement ? "Save replacement status" : "Prepare replacement shipment"}</Button></div>
      </fieldset></form>}
      {!history.current && <p>Save an open shipment case to prepare a replacement.</p>}
      {history.replacements.map(row => <article className="inv-panel" key={row.id}><h4>Replacement · {row.status}</h4><p>{row.lines.map(line => `${line.quantity} × ${line.sku}`).join(", ")}</p><p>Tracking: {row.trackingNumber || "Not recorded"}</p><p>Ship to: {row.destination.recipientName}, {row.destination.address1} {row.destination.address2}, {row.destination.city}, {row.destination.region} {row.destination.postalCode}</p>
        <details><summary>Replacement history ({row.history.length})</summary>{row.history.map(event => <div key={event.revision}><p>#{event.revision} · {event.status} · {new Date(event.createdAt).toLocaleString()}</p><p>{event.trackingNumber}</p><p>{event.note}</p></div>)}</details></article>)}
      <details><summary>Case history ({history.history.length})</summary>{history.history.map(event => <article className="inv-panel" key={event.revision}><p>#{event.revision} · {event.input.kind} · {event.input.status} · {new Date(event.createdAt).toLocaleString()}</p><p>{event.input.items.map(item => `${item.quantity} × ${history.lines.find(line => line.variantId === item.variantId)?.sku ?? item.variantId}`).join(", ")}</p><p>{event.input.note}</p>{event.input.resolution && <p>Resolution: {resolutionLabels[event.input.resolution]}</p>}<p>Carrier: {event.input.carrier || "Not recorded"} · Claim: {event.input.claimReference || "None"}</p>{event.input.evidence && <p className="shipment-evidence">Evidence: {event.input.evidence}</p>}{event.input.refundId && <p>Linked refund: {event.input.refundId}</p>}{event.input.returnId && <p>Linked return: {event.input.returnId}</p>}</article>)}</details>
    </>}
  </section>;
}
