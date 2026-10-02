"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { parseCommissionBudget, proposalCommandSchema, proposalTotals, type ProposalCommand, type ProposalInput } from "@sadboi/core";
import type { proposalDetail, ProposalRecord } from "@/server/proposals";
import { inventoryRequest, InventoryRequestError } from "@/lib/inventory-client";
import { Button, Input, Textarea, PageHeading } from "./ui";
type Detail = Awaited<ReturnType<typeof proposalDetail>>;
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
function Document({ record, superseded, historical }: { record: ProposalRecord; superseded: boolean; historical: boolean }) {
  const { input } = record, totals = proposalTotals(input);
  return <article className="proposal-document" aria-label="Proposal document">
    <p className="eyebrow">SADBOI / PROPOSAL</p><h2>{input.title}</h2>
    <p><strong>{record.number ?? "Unnumbered draft"} · Version {record.version}</strong> · {superseded ? "Superseded" : record.state}</p>
    {historical && !superseded && <p><strong>Historical snapshot — consult the current proposal for its latest status.</strong></p>}
    {record.state === "draft" && <p><strong>DRAFT — not issued</strong></p>}
    <p>Prepared for {record.client.name}{record.client.email ? ` · ${record.client.email}` : ""}</p>
    <p>{record.issuedAt ? `Issued ${record.issuedAt.slice(0, 10)} · ` : ""}Valid through {input.validUntil} (UTC)</p>
    <h3>Scope</h3><p className="preserve-lines">{input.scope}</p>
    <h3>Deliverables</h3><p className="preserve-lines">{input.deliverables}</p>
    <h3>Timing</h3><p className="preserve-lines">{input.timeline}</p>
    <h3>Included revisions</h3><p className="preserve-lines">{input.revisionPolicy}</p>
    <h3>Price · USD</h3>
    <div className="proposal-lines">{input.lines.map((line, i) => <div key={i}><strong>{line.description}</strong><span>{line.quantity} × {money(line.unitMinor)}</span><span>{money(line.quantity * line.unitMinor)}</span></div>)}</div>
    <dl className="proposal-totals"><div><dt>Subtotal</dt><dd>{money(totals.subtotalMinor)}</dd></div><div><dt>Discount</dt><dd>−{money(input.discountMinor)}</dd></div><div><dt>Tax ({input.taxStatus.replaceAll("_", " ")})</dt><dd>{money(input.taxMinor)}</dd></div><div><dt><strong>Total</strong></dt><dd><strong>{money(totals.totalMinor)}</strong></dd></div></dl>
    <p className="preserve-lines">{input.taxNote}</p>
    {input.terms && <><h3>Additional terms</h3><p className="preserve-lines">{input.terms}</p></>}
    <p>This proposal is not an invoice or payment receipt. Any required agreement and payment arrangements are handled separately.</p>
  </article>;
}
function Draft({ detail, frozen, onSave }: { detail: Detail; frozen: boolean; onSave: (command: ProposalCommand) => void }) {
  const initial: ProposalInput = detail.record?.input ?? { ...detail.seed, timeline: "", revisionPolicy: "", terms: "", validUntil: "", currency: "USD", lines: [{ description: "Commission artwork", quantity: 1, unitMinor: 0 }], discountMinor: 0, taxMinor: 0, taxStatus: "not_calculated", taxNote: "Tax has not been calculated." };
  const [input, setInput] = useState(initial), [prices, setPrices] = useState(initial.lines.map(row => (row.unitMinor / 100).toFixed(2)));
  const [discount, setDiscount] = useState((initial.discountMinor / 100).toFixed(2)), [tax, setTax] = useState((initial.taxMinor / 100).toFixed(2));
  const [note, setNote] = useState(""), [error, setError] = useState("");
  const patch = (values: Partial<ProposalInput>) => setInput({ ...input, ...values });
  return <form className="inv-form" onSubmit={event => {
    event.preventDefault(); if (frozen) return; setError("");
    try {
      const cents = (value: string) => { const result = parseCommissionBudget(value); if (result === null) throw new Error("Enter each price, discount and tax amount; use 0 for none."); return result; };
      const parsed = proposalCommandSchema.safeParse({ action: "save", source: detail.source, expectedRevision: detail.record?.revision ?? 0, operationId: crypto.randomUUID(), note,
        input: { ...input, lines: input.lines.map((row, i) => ({ ...row, unitMinor: cents(prices[i]) })), discountMinor: cents(discount), taxMinor: cents(tax) } });
      if (!parsed.success) throw new Error(parsed.error.issues.map(issue => issue.message).join(" ")); onSave(parsed.data);
    } catch (err) { setError(err instanceof Error ? err.message : "Check the proposal."); }
  }}><fieldset className="commission-fields" disabled={frozen}><legend>{detail.record ? "Edit draft" : "Create estimate draft"}</legend>
    <p>Prepared for {detail.client.name}. Review the copied brief and make every field suitable for the client. Private project notes are not copied.</p>
    <Input label="Proposal title" required minLength={3} maxLength={180} value={input.title} onChange={e => patch({ title: e.target.value })} />
    <Textarea label="Proposed scope" required minLength={3} maxLength={4000} value={input.scope} onChange={e => patch({ scope: e.target.value })} />
    <Textarea label="Proposed deliverables" required minLength={3} maxLength={3000} value={input.deliverables} onChange={e => patch({ deliverables: e.target.value })} />
    <Textarea label="Timing and dependencies" required minLength={3} maxLength={2000} value={input.timeline} onChange={e => patch({ timeline: e.target.value })} />
    <Textarea label="Included revisions and extra-work policy" required minLength={3} maxLength={2000} value={input.revisionPolicy} onChange={e => patch({ revisionPolicy: e.target.value })} />
    <Input label="Valid through (UTC)" type="date" required value={input.validUntil} onChange={e => patch({ validUntil: e.target.value })} />
    <h3>Itemized price</h3>{input.lines.map((line, i) => <fieldset className="commission-fields inv-panel" key={i}><legend>Item {i + 1}</legend>
      <Input label={`Item ${i + 1} description`} required maxLength={300} value={line.description} onChange={e => patch({ lines: input.lines.map((row, j) => j === i ? { ...row, description: e.target.value } : row) })} />
      <div className="field-grid"><Input label={`Item ${i + 1} quantity`} type="number" required min={1} max={1000} step={1} value={Number.isNaN(line.quantity) ? "" : line.quantity} onChange={e => patch({ lines: input.lines.map((row, j) => j === i ? { ...row, quantity: e.target.valueAsNumber } : row) })} />
      <Input label={`Item ${i + 1} unit price (USD)`} required inputMode="decimal" value={prices[i]} onChange={e => setPrices(prices.map((value, j) => j === i ? e.target.value : value))} /></div>
      {input.lines.length > 1 && <Button variant="ghost" onClick={() => { patch({ lines: input.lines.filter((_, j) => j !== i) }); setPrices(prices.filter((_, j) => j !== i)); }}>Remove item {i + 1}</Button>}
    </fieldset>)}
    <Button variant="secondary" disabled={input.lines.length >= 20} onClick={() => { patch({ lines: [...input.lines, { description: "", quantity: 1, unitMinor: 0 }] }); setPrices([...prices, "0.00"]); }}>Add price item</Button>
    <div className="field-grid"><Input label="Discount (USD)" required inputMode="decimal" value={discount} onChange={e => setDiscount(e.target.value)} /><Input label="Tax amount (USD)" required inputMode="decimal" value={tax} onChange={e => setTax(e.target.value)} /></div>
    <label className="field">Tax treatment<select value={input.taxStatus} onChange={e => patch({ taxStatus: e.target.value as ProposalInput["taxStatus"] })}><option value="not_calculated">Not calculated — draft only</option><option value="not_applicable">Not applicable</option><option value="calculated">Calculated manually</option></select></label>
    <Textarea label="Tax explanation for client" required minLength={3} maxLength={1000} value={input.taxNote} onChange={e => patch({ taxNote: e.target.value })} />
    <Textarea label="Additional terms (optional)" maxLength={4000} value={input.terms} onChange={e => patch({ terms: e.target.value })} />
    <Textarea label="Private change note" required minLength={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} />
    {error && <p className="notice error" role="alert">{error}</p>}<Button type="submit">Save estimate draft</Button>
  </fieldset></form>;
}
export function Proposal({ initial, canEdit }: { initial: Detail; canEdit: boolean }) {
  const [detail, setDetail] = useState(initial), [busy, setBusy] = useState(false), [pending, setPending] = useState<ProposalCommand | null>(null);
  const [message, setMessage] = useState(""), [note, setNote] = useState(""), [reference, setReference] = useState(""), [preview, setPreview] = useState<ProposalRecord | null>(null), [editorEpoch, setEditorEpoch] = useState(0);
  const lock = useRef(false), record = detail.record, frozen = busy || !!pending, key = `sadboi-proposal-pending:${detail.seriesId}`;
  const path = `/api/proposals?kind=${detail.source.kind}&id=${detail.source.id}`;
  function remember(command: ProposalCommand | null) { setPending(command); try { if (command) sessionStorage.setItem(key, JSON.stringify(command)); else sessionStorage.removeItem(key); } catch { /* In-memory recovery remains available. */ } }
  async function reload() {
    if (lock.current) return; lock.current = true; setBusy(true);
    try { setDetail(await inventoryRequest(path)); setEditorEpoch(value => value + 1); setPreview(null); setNote(""); setReference(""); setMessage("Loaded saved proposal. Unsaved edits were discarded."); }
    catch (err) { setMessage(err instanceof Error ? err.message : "Could not reload proposal."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function save(command: ProposalCommand) {
    try { const recovered = proposalCommandSchema.safeParse(JSON.parse(sessionStorage.getItem(key) ?? "null")); if (recovered.success && recovered.data.operationId !== command.operationId) { setPending(recovered.data); setMessage("A previous proposal save needs confirmation. Retry it first."); return; } } catch { /* The mounted form retains its pending request. */ }
    if (lock.current) return; lock.current = true; setBusy(true); remember(command); setMessage("");
    try {
      await inventoryRequest("/api/proposals", { method: "POST", body: JSON.stringify(command) });
      // Keep the command recoverable until the resulting record is loaded.
      setDetail(await inventoryRequest(path)); remember(null); setPreview(null); setNote(""); setReference("");
      setMessage(command.action === "issue" ? "Proposal issued and frozen. Use Print / save PDF to share it yourself. No email was sent." : command.action === "accept" ? "Client acceptance recorded. Agreement and payment remain separate." : "Proposal saved with history.");
    } catch (err) { if (err instanceof InventoryRequestError && [400, 404, 409, 413].includes(err.status)) remember(null); setMessage(err instanceof Error ? err.message : "Save result unknown. Retry the same proposal action."); }
    finally { lock.current = false; setBusy(false); }
  }
  function action(action: Exclude<ProposalCommand["action"], "save">) {
    const parsed = proposalCommandSchema.safeParse({ action, source: detail.source, operationId: crypto.randomUUID(), expectedRevision: record?.revision ?? 0, note, ...(["accept", "decline"].includes(action) ? { responseReference: reference } : {}) });
    if (!parsed.success) { setMessage("Enter an action note of at least three characters and, for a client response, its evidence/reference."); return; } void save(parsed.data);
  }
  const document = preview ?? record;
  const versions = detail.history.filter((event, i, all) => all.findIndex(other => other.record.version === event.record.version) === i);
  return <div className="commissions proposals">
    <div className="proposal-controls">
      <PageHeading eyebrow="PROJECTS / ESTIMATES & PROPOSALS" title={record?.number ?? "Prepare a proposal."} description="Agree on the scope and price before moving into agreements and payments." />
      <p><Link className="inline-link" href="/admin/projects">Back to projects</Link> · <Link className="inline-link" href="/admin/how-to#proposals">How to prepare proposals</Link></p>
      <p>One proposal series is shared by this inquiry and its project. Issuing freezes the saved version; it does not send it. Acceptance records a response received elsewhere and does not start work or collect a deposit.</p>
      {!canEdit && <p className="notice">Accounting can read proposals and history. Only super admins make changes.</p>}
      {message && <p role="status" className="notice">{message}</p>}
      <div className="inv-actions"><Button variant="secondary" disabled={frozen} onClick={() => void reload()}>Reload proposal</Button>
      {canEdit && <Button variant="ghost" disabled={frozen} onClick={() => { try { const saved = proposalCommandSchema.safeParse(JSON.parse(sessionStorage.getItem(key) ?? "null")); if (saved.success) { setPending(saved.data); setMessage("Review the pending action and retry its original request."); } else setMessage("No interrupted proposal action was found in this tab."); } catch { setMessage("Browser storage is unavailable. Check proposal history before saving again."); } }}>Recover interrupted proposal action</Button>}
      {pending && <Button disabled={busy} onClick={() => void save(pending)}>Retry same proposal action</Button>}</div>
      {pending && <p className="notice">Pending action: {pending.action}. Note: {pending.note}. Retry before making another change.</p>}
      {record && <p><strong>Version {record.version} · {record.state}</strong> · Saved {new Date(record.updatedAt).toLocaleString()} · Total {money(proposalTotals(record.input).totalMinor)}</p>}
      {record?.state === "issued" && record.input.validUntil < new Date().toISOString().slice(0, 10) && <p className="notice">This proposal has expired. Create a revised draft before recording acceptance.</p>}
      {record?.responseReference && <p className="preserve-lines">Private response reference: {record.responseReference}</p>}
      {canEdit && (!record || record.state === "draft") && <Draft key={`${record?.revision ?? 0}:${editorEpoch}`} detail={detail} frozen={frozen || (record?.revision ?? 0) >= 100} onSave={command => void save(command)} />}
      {canEdit && record && record.state !== "accepted" && <fieldset className="commission-fields inv-form" disabled={frozen || record.revision >= 100}>
        <legend>Proposal actions</legend>
        <Textarea label="Action note (private)" maxLength={2000} value={note} onChange={e => setNote(e.target.value)} />
        {record.state === "issued" && <Textarea label="Client response evidence/reference (private)" maxLength={2000} value={reference} onChange={e => setReference(e.target.value)} helperText="Identify who replied, when, and where the response is retained, such as an email subject and date." />}
        <div className="inv-actions">{record.state === "draft" ? <Button onClick={() => action("issue")}>Issue saved proposal</Button> : <Button variant="secondary" disabled={record.version >= 20} onClick={() => action("revise")}>Create revised draft</Button>}
        {record.state === "issued" && <><Button onClick={() => action("accept")}>Record client acceptance</Button><Button variant="secondary" onClick={() => action("decline")}>Record client decline</Button><Button variant="ghost" onClick={() => action("withdraw")}>Withdraw proposal</Button></>}</div>
        <p>{record.state === "draft" ? "Save all changes first. Issuing uses the saved draft below, requires resolved tax and a current validity date, and freezes its contents." : "Creating a revised draft supersedes the issued offer. Share the replacement with the client yourself. Accepted proposals are final in this workflow."}</p>
      </fieldset>}
      {record?.state === "accepted" && <p className="notice">Accepted proposals are read-only. Agreements, deposits and later change orders are separate workflows.</p>}
      {(record?.revision ?? 0) >= 100 && <p className="notice">The 100-change limit has been reached. History remains available; ask the administrator to review before further work.</p>}
      <section aria-label="Proposal history"><h2>Proposal history</h2>
        {!record && <p>Save the first draft to review the calculated totals and document.</p>}
        {versions.map(event => <p key={event.record.version}><Button variant="secondary" onClick={() => setPreview(event.record)}>Preview version {event.record.version}</Button> {event.record.state}{event.record.version < (record?.version ?? 1) ? " · Superseded" : ""}</p>)}
        {detail.history.map(event => <details key={event.record.revision}><summary>Change {event.record.revision} · Version {event.record.version} · {event.action} · {new Date(event.record.updatedAt).toLocaleString()}</summary><p className="preserve-lines">{event.note}</p>{event.record.responseReference && <p className="preserve-lines">{event.record.responseReference}</p>}<Button variant="ghost" onClick={() => setPreview(event.record)}>Preview this saved snapshot</Button></details>)}
      </section>
      {document && <div className="inv-actions"><Button variant="secondary" onClick={() => { setPreview(null); }}>Show current document</Button><Button onClick={() => window.print()}>Print / save PDF</Button><p>Prints only the document below. Turn off browser headers and footers in print settings to omit the private page URL.</p></div>}
    </div>
    {document && <Document record={document} superseded={document.version < (record?.version ?? 1)} historical={document.revision !== record?.revision} />}
  </div>;
}
