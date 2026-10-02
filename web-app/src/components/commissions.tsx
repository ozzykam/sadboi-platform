"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { commissionCommandSchema, inquiryStages, projectStatuses, parseCommissionBudget, type CommissionCommand, type CommissionInquiry, type CommissionProject } from "@sadboi/core";
import type { commissionDirectory, commissionDetail, CommissionRecord } from "@/server/commissions";
import { inventoryRequest, InventoryRequestError } from "@/lib/inventory-client";
import { Button, Input, Textarea, Badge, PageHeading } from "./ui";
type Directory = Awaited<ReturnType<typeof commissionDirectory>>;
type Detail = Awaited<ReturnType<typeof commissionDetail>>;
type Plan = CommissionInquiry | CommissionProject;
const label = (text: string) => text.replaceAll("_", " ");
const budgetLabel = (value: number | null) => value === null ? "Not specified" : `$${(value / 100).toFixed(2)} USD`;
const pendingKey = "sadboi-commission-pending";
const blank: CommissionInquiry = { contactId: "", title: "", brief: "", deliverables: "", budgetMinor: null, deadline: "", notes: "", archived: false, stage: "new", qualification: "", nextFollowUp: "" };
function Snapshot({ input }: { input: Plan }) {
  return <div className="commission-snapshot">
    <p><strong>{input.title}</strong> · {"stage" in input ? label(input.stage) : label(input.status)}{input.archived ? " · Archived" : ""}</p>
    <p>Planning budget: {budgetLabel(input.budgetMinor)} · Desired deadline: {input.deadline || "None"}</p>
    <h4>Brief</h4><p className="preserve-lines">{input.brief}</p>
    <h4>Deliverables</h4><p className="preserve-lines">{input.deliverables}</p>
    {"qualification" in input && <><h4>Qualification</h4><p className="preserve-lines">{input.qualification || "No qualification notes."}</p><p>Next follow-up: {input.nextFollowUp || "None"}</p></>}
    {input.notes && <><h4>Private notes</h4><p className="preserve-lines">{input.notes}</p></>}
    {"tasks" in input && <>
      <h4>Milestones</h4>{!input.milestones.length && <p>No milestones yet.</p>}
      {input.milestones.map(row => <div key={row.id}><p><strong>{row.title}</strong> · {label(row.status)} · {row.dueDate || "No due date"}</p><p className="preserve-lines">{row.notes}</p></div>)}
      <h4>Tasks</h4>{!input.tasks.length && <p>No tasks yet.</p>}
      {input.tasks.map(row => <div key={row.id}><p><strong>{row.title}</strong> · {label(row.status)} · {row.dueDate || "No due date"}{row.milestoneId ? ` · ${input.milestones.find(m => m.id === row.milestoneId)?.title}` : ""}</p><p className="preserve-lines">{row.notes}</p></div>)}
    </>}
  </div>;
}
function Editor({ record, contacts, frozen, onSave }: { record?: CommissionRecord; contacts: Directory["contacts"]; frozen: boolean; onSave: (input: CommissionCommand) => void }) {
  const [input, setInput] = useState<Plan>(record?.input ?? blank), [note, setNote] = useState("");
  const [budget, setBudget] = useState(record?.input.budgetMinor == null ? "" : (record.input.budgetMinor / 100).toFixed(2));
  const [error, setError] = useState("");
  const inquiry = "stage" in input, locked = frozen || !!record?.projectId || (record?.revision ?? 0) >= 200;
  const patch = (values: Partial<Plan>) => setInput({ ...input, ...values } as Plan);
  function submit(event: React.FormEvent) {
    event.preventDefault(); if (locked) return; setError("");
    try {
      const parsed = commissionCommandSchema.safeParse({ action: inquiry ? "inquiry" : "project", id: record?.id ?? null,
        expectedRevision: record?.revision ?? 0, operationId: crypto.randomUUID(), input: { ...input, budgetMinor: parseCommissionBudget(budget) }, note });
      if (!parsed.success) throw new Error(parsed.error.issues.map(issue => issue.message).join(" "));
      onSave(parsed.data);
    } catch (err) { setError(err instanceof Error ? err.message : "Check the form."); }
  }
  return <form className="inv-form commission-editor" onSubmit={submit}>
    <fieldset disabled={locked} className="commission-fields"><legend>{record ? "Edit saved details" : "New inquiry"}</legend>
      {inquiry ? <label className="field">Contact<select required value={input.contactId} onChange={e => patch({ contactId: e.target.value })}>
        <option value="">Choose a contact</option>{contacts.filter(row => row.status === "active" || row.id === input.contactId).map(row => <option key={row.id} value={row.id}>{row.name}{row.status === "archived" ? " (archived)" : ""}</option>)}
      </select></label> : <p>Linked contact: {record?.contact.name}. The accepted inquiry remains attached to this project.</p>}
      <Input label="Title" required minLength={3} maxLength={180} value={input.title} onChange={e => patch({ title: e.target.value })} />
      <Textarea label="Brief" required minLength={3} maxLength={4000} value={input.brief} onChange={e => patch({ brief: e.target.value })} />
      <Textarea label="Deliverables" required minLength={3} maxLength={3000} value={input.deliverables} onChange={e => patch({ deliverables: e.target.value })} />
      <div className="field-grid"><Input label="Planning budget (USD, optional)" inputMode="decimal" value={budget} onChange={e => setBudget(e.target.value)} />
        <Input label="Desired deadline (optional)" type="date" value={input.deadline} onChange={e => patch({ deadline: e.target.value })} /></div>
      {inquiry ? <>
        <label className="field">Inquiry stage<select value={input.stage} onChange={e => patch({ stage: e.target.value as CommissionInquiry["stage"] })}>{inquiryStages.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <Textarea label="Qualification notes" maxLength={2000} value={input.qualification} onChange={e => patch({ qualification: e.target.value })} />
        <Input label="Next follow-up (optional)" type="date" value={input.nextFollowUp} onChange={e => patch({ nextFollowUp: e.target.value })} />
      </> : <>
        <label className="field">Project status<select value={input.status} onChange={e => patch({ status: e.target.value as CommissionProject["status"] })}>{projectStatuses.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <p>Finish or cancel tasks and complete or skip milestones before completing the project. Reopen closed work as Active, Planned or On hold before changing it.</p>
        <h3>Milestones</h3>
        {input.milestones.map((row, index) => <fieldset className="commission-fields inv-panel" key={row.id}><legend>Milestone {index + 1}</legend>
          <Input label={`Milestone ${index + 1} title`} required maxLength={180} value={row.title} onChange={e => patch({ milestones: input.milestones.map(m => m.id === row.id ? { ...m, title: e.target.value } : m) })} />
          <Input label={`Milestone ${index + 1} due date`} type="date" value={row.dueDate} onChange={e => patch({ milestones: input.milestones.map(m => m.id === row.id ? { ...m, dueDate: e.target.value } : m) })} />
          <label className="field">Milestone {index + 1} status<select value={row.status} onChange={e => patch({ milestones: input.milestones.map(m => m.id === row.id ? { ...m, status: e.target.value as typeof m.status } : m) })}>{["planned", "in_progress", "completed", "skipped"].map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>
          <Textarea label={`Milestone ${index + 1} notes`} maxLength={1000} value={row.notes} onChange={e => patch({ milestones: input.milestones.map(m => m.id === row.id ? { ...m, notes: e.target.value } : m) })} />
          {record && "milestones" in record.input && !record.input.milestones.some(m => m.id === row.id) && <Button variant="ghost" onClick={() => patch({ milestones: input.milestones.filter(m => m.id !== row.id), tasks: input.tasks.map(t => t.milestoneId === row.id ? { ...t, milestoneId: "" } : t) })}>Remove unsaved milestone {index + 1}</Button>}
        </fieldset>)}
        <Button variant="secondary" disabled={input.milestones.length >= 20} onClick={() => patch({ milestones: [...input.milestones, { id: crypto.randomUUID(), title: "", dueDate: "", notes: "", status: "planned" }] })}>Add milestone</Button>
        <h3>Tasks</h3>
        {input.tasks.map((row, index) => <fieldset className="commission-fields inv-panel" key={row.id}><legend>Task {index + 1}</legend>
          <Input label={`Task ${index + 1} title`} required maxLength={180} value={row.title} onChange={e => patch({ tasks: input.tasks.map(t => t.id === row.id ? { ...t, title: e.target.value } : t) })} />
          <Input label={`Task ${index + 1} due date`} type="date" value={row.dueDate} onChange={e => patch({ tasks: input.tasks.map(t => t.id === row.id ? { ...t, dueDate: e.target.value } : t) })} />
          <label className="field">Task {index + 1} status<select value={row.status} onChange={e => patch({ tasks: input.tasks.map(t => t.id === row.id ? { ...t, status: e.target.value as typeof t.status } : t) })}>{["todo", "in_progress", "done", "cancelled"].map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>
          <label className="field">Task {index + 1} milestone<select value={row.milestoneId} onChange={e => patch({ tasks: input.tasks.map(t => t.id === row.id ? { ...t, milestoneId: e.target.value } : t) })}><option value="">No milestone</option>{input.milestones.map(m => <option key={m.id} value={m.id}>{m.title || "Untitled milestone"}</option>)}</select></label>
          <Textarea label={`Task ${index + 1} notes`} maxLength={1000} value={row.notes} onChange={e => patch({ tasks: input.tasks.map(t => t.id === row.id ? { ...t, notes: e.target.value } : t) })} />
          {record && "tasks" in record.input && !record.input.tasks.some(t => t.id === row.id) && <Button variant="ghost" onClick={() => patch({ tasks: input.tasks.filter(t => t.id !== row.id) })}>Remove unsaved task {index + 1}</Button>}
        </fieldset>)}
        <Button variant="secondary" disabled={input.tasks.length >= 40} onClick={() => patch({ tasks: [...input.tasks, { id: crypto.randomUUID(), title: "", dueDate: "", notes: "", milestoneId: "", status: "todo" }] })}>Add task</Button>
        <p>Saved tasks cannot be removed; cancel them instead. Skip unwanted milestones. Limits: 40 tasks and 20 milestones.</p>
      </>}
      <Textarea label="Private notes" maxLength={4000} value={input.notes} onChange={e => patch({ notes: e.target.value })} />
      <label className="field">Visibility<select value={input.archived ? "archived" : "active"} onChange={e => patch({ archived: e.target.value === "archived" })}><option value="active">Active list</option><option value="archived">Archived</option></select></label>
      <Textarea label="Update note" required minLength={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} helperText="Explain this change for the private history." />
      {error && <p className="notice error" role="alert">{error}</p>}
      <Button type="submit">{inquiry ? "Save inquiry" : "Save project"}</Button>
    </fieldset>
  </form>;
}
export function Commissions({ initial, canEdit }: { initial: Directory; canEdit: boolean }) {
  const [directory, setDirectory] = useState(initial), [detail, setDetail] = useState<Detail | null>(null), [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<"inquiry" | "project">("inquiry"), [query, setQuery] = useState(""), [stage, setStage] = useState("all"), [archived, setArchived] = useState(false);
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [pending, setPending] = useState<CommissionCommand | null>(null), [conversionNote, setConversionNote] = useState("");
  const lock = useRef(false), frozen = busy || !!pending;
  function remember(command: CommissionCommand | null) { setPending(command); try { if (command) sessionStorage.setItem(pendingKey, JSON.stringify(command)); else sessionStorage.removeItem(pendingKey); } catch { /* In-memory retry remains available. */ } }
  async function open(kind: "inquiry" | "project", id: string) {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage("");
    try { setDetail(await inventoryRequest(`/api/commissions?kind=${kind}&id=${id}`)); setAdding(false); setConversionNote(""); }
    catch (err) { setMessage(err instanceof Error ? err.message : "Could not load the record."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function refresh() {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage("");
    try { setDirectory(await inventoryRequest("/api/commissions")); }
    catch (err) { setMessage(err instanceof Error ? err.message : "Could not refresh projects."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function save(command: CommissionCommand) {
    // A reopened tab must resolve an older unknown request before creating a new one.
    try {
      const recovered = commissionCommandSchema.safeParse(JSON.parse(sessionStorage.getItem(pendingKey) ?? "null"));
      if (recovered.success && recovered.data.operationId !== command.operationId) {
        setPending(recovered.data); setMessage("A previous save still needs confirmation. Retry it before saving another change."); return;
      }
    } catch { /* In-memory recovery still protects this mounted form. */ }
    if (lock.current) return; lock.current = true; setBusy(true); setMessage(""); remember(command);
    try {
      const result: { id: string; kind: "inquiry" | "project" } = await inventoryRequest("/api/commissions", { method: "POST", body: JSON.stringify(command) });
      remember(null); setDetail(null); setAdding(false); setTab(result.kind); setStage("all"); setConversionNote("");
      setMessage(command.action === "convert" ? "Project created from the accepted inquiry. No agreement, invoice or payment was created." : "Saved with private history.");
      try {
        const [list, saved] = await Promise.all([inventoryRequest("/api/commissions"), inventoryRequest(`/api/commissions?kind=${result.kind}&id=${result.id}`)]);
        setDirectory(list); setDetail(saved);
      } catch { setMessage("Saved, but the updated record could not load. Refresh projects before continuing."); }
    } catch (err) {
      if (err instanceof InventoryRequestError && [400, 404, 409, 413].includes(err.status)) remember(null);
      setMessage(err instanceof Error ? err.message : "Save result unknown. Retry the same save.");
    } finally { lock.current = false; setBusy(false); }
  }
  const rows = directory.rows.filter(row => row.kind === tab && row.archived === archived && (stage === "all" || row.state === stage) && `${row.title} ${row.contact.name} ${row.contact.email}`.toLowerCase().includes(query.toLowerCase()));
  const selected = detail?.record;
  return <div className="commissions">
    <PageHeading eyebrow="PROJECTS / COMMISSIONS" title="From an inquiry to finished work." description="Plan commissions, track milestones, and keep the studio's working history together." action={<Button variant="secondary" disabled={frozen} onClick={() => void refresh()}>Refresh projects</Button>} />
    <p><Link className="inline-link" href="/admin/how-to#commissions">How to manage inquiries and projects</Link> · <Link className="inline-link" href="/admin/contacts">Manage contacts</Link></p>
    <p>Acceptance of an inquiry records the studio’s decision. Open Estimates and proposals on a saved record to prepare client pricing. Agreements, invoices, payments and client proof approvals are separate steps. Dates do not send reminders.</p>
    {!canEdit && <p className="notice">Accounting has read-only access. Super admins manage inquiries and projects.</p>}
    {message && <p className="notice" role="status">{message}</p>}
    {canEdit && <div className="inv-actions"><Button variant="ghost" disabled={frozen} onClick={() => {
      try { const parsed = commissionCommandSchema.safeParse(JSON.parse(sessionStorage.getItem(pendingKey) ?? "null")); if (!parsed.success) { setMessage("No recoverable save was found in this tab."); return; } setPending(parsed.data); setMessage("A previous save needs confirmation. Retry its original request."); }
      catch { setMessage("Browser storage is unavailable. Check saved records before starting another request."); }
    }}>Recover interrupted save</Button>{pending && <Button disabled={busy} onClick={() => void save(pending)}>Retry same commission save</Button>}</div>}
    {pending && <p className="notice">Pending: {pending.action === "convert" ? `Create project from ${directory.rows.find(row => row.id === pending.id)?.title ?? "the accepted inquiry"}` : `Save ${pending.input.title}`}. Retry the same request before editing again.</p>}
    {adding || selected ? <section className="inv-panel">
      <div className="section-heading"><h2>{adding ? "Add inquiry" : selected?.input.title}</h2><Button variant="ghost" disabled={frozen} onClick={() => { setDetail(null); setAdding(false); setMessage(""); }}>Back to list</Button></div>
      {selected && <>
        <p>Contact at intake: {selected.contact.name}{selected.contact.email ? ` · ${selected.contact.email}` : ""}. Contact-directory changes do not rewrite this snapshot.</p>
        <p>Revision {selected.revision} · Last saved {new Date(selected.updatedAt).toLocaleString()}</p>
        {selected.revision >= 200 && <p className="notice">This record reached its 200-version limit. History remains available; ask the administrator to review it before further changes.</p>}
        <div className="inv-actions"><Button variant="secondary" disabled={frozen} onClick={() => void open(selected.kind, selected.id)}>Reload saved record</Button>
        {selected.projectId && <Button disabled={frozen} onClick={() => void open("project", selected.projectId!)}>Open linked project</Button>}
        {selected.inquiryId && <Button variant="secondary" disabled={frozen} onClick={() => void open("inquiry", selected.inquiryId!)}>Open source inquiry</Button>}</div>
        {selected.acceptedBrief && <details><summary>Accepted inquiry snapshot</summary><Snapshot input={selected.acceptedBrief} /></details>}
        <Snapshot input={selected.input} />
        <p><Link className="button secondary" href={`/admin/projects/proposal?kind=${selected.kind}&id=${selected.id}`}>Estimates and proposals</Link></p>
      </>}
      {canEdit && !selected?.projectId && <Editor key={selected ? selected.kind + selected.id + selected.revision : "new"} record={selected} contacts={directory.contacts} frozen={frozen} onSave={command => void save(command)} />}
      {canEdit && selected?.kind === "inquiry" && selected.revision < 200 && !selected.projectId && "stage" in selected.input && selected.input.stage === "accepted" && !selected.input.archived && <form className="inv-form" onSubmit={event => {
        event.preventDefault(); if (frozen) return;
        const parsed = commissionCommandSchema.safeParse({ action: "convert", id: selected.id, expectedRevision: selected.revision, operationId: crypto.randomUUID(), note: conversionNote });
        if (!parsed.success) { setMessage("Enter a conversion note of at least three characters."); return; } void save(parsed.data);
      }}><fieldset className="commission-fields" disabled={frozen}><legend>Create the project</legend><p>Uses the saved accepted brief. Save any edits above first. Each inquiry creates one project.</p><Textarea label="Conversion note" required minLength={3} maxLength={2000} value={conversionNote} onChange={e => setConversionNote(e.target.value)} /><Button type="submit">Create project from inquiry</Button></fieldset></form>}
      {detail && <section aria-label="Commission history"><h3>Progress and change history</h3><p>Showing {detail.history.length} of {detail.record.revision} saved versions. Older versions remain stored.</p>{detail.history.map(event => <details key={event.revision}><summary>Version {event.revision} · {new Date(event.createdAt).toLocaleString()}</summary><p className="preserve-lines">{event.note}</p><Snapshot input={event.input} /></details>)}</section>}
      <p>Reload saved record and Back to list discard unsaved edits. After an uncertain save, retry the same request. Use Recover interrupted save after reopening this tab. Archive hides a record from the active list; it does not delete history or cancel a project.</p>
    </section> : <>
      <div className="inv-toolbar"><label className="field">View<select disabled={frozen} value={tab} onChange={e => { setTab(e.target.value as typeof tab); setStage("all"); }}><option value="inquiry">Inquiries</option><option value="project">Projects</option></select></label>
        <Input label="Search title or contact" type="search" value={query} onChange={e => setQuery(e.target.value)} />
        <label className="field">Stage or status<select value={stage} onChange={e => setStage(e.target.value)}><option value="all">All</option>{(tab === "inquiry" ? inquiryStages : projectStatuses).map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <label className="field">Show<select value={archived ? "archived" : "active"} onChange={e => setArchived(e.target.value === "archived")}><option value="active">Active list</option><option value="archived">Archived</option></select></label>
        {canEdit && <Button disabled={frozen} onClick={() => { setAdding(true); setMessage(""); }}>Add inquiry</Button>}
      </div>
      {!rows.length && <div className="empty-state roomy"><h2>No matching {tab === "inquiry" ? "inquiries" : "projects"}.</h2><p>{tab === "inquiry" ? "Add the client in Contacts, then record their commission brief here." : "Accept an inquiry and choose Create project from inquiry to start planning."}</p></div>}
      <div className="inv-cards">{rows.map(row => <article key={row.kind + row.id} className="inv-panel"><h2>{row.title}</h2><Badge>{label(row.state)}{row.projectId ? " · Project created" : ""}</Badge><p>{row.contact.name}</p><p>Planning budget: {budgetLabel(row.budgetMinor)}</p><p>Desired deadline: {row.deadline || "None"}</p>{row.nextFollowUp && <p>Follow up: {row.nextFollowUp}</p>}<Button disabled={frozen} variant="secondary" onClick={() => void open(row.kind, row.id)}>Open {row.kind}</Button></article>)}</div>
    </>}
  </div>;
}
