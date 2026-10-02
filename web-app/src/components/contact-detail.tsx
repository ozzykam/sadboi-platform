"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { contactActivityKinds, type ContactRecord } from "@sadboi/core";
import { Pencil, Plus, X } from "lucide-react";
import { inventoryRequest } from "@/lib/inventory-client";
import { Badge, Button, Input, PageHeading, Textarea } from "./ui";
import { Select } from "./inventory-form";

const activityLabels: Record<(typeof contactActivityKinds)[number], string> = {
  email: "Email",
  call: "Call",
  meeting: "Meeting",
  message: "Message",
  note: "Note",
  other: "Other",
};
type ActivityDraft = {
  id: string;
  date: string;
  kind: (typeof contactActivityKinds)[number];
  summary: string;
  followUpDate: string;
  followUpNote: string;
  followUpCompleted: boolean;
  hasFollowUp: boolean;
};

export function ContactDetail({ record, canEdit }: { record: ContactRecord; canEdit: boolean }) {
  const [current, setCurrent] = useState(record),
    [editingIndex, setEditingIndex] = useState<number | null>(null),
    [draft, setDraft] = useState<ActivityDraft>({ id: "", date: new Date().toISOString().slice(0, 10), kind: contactActivityKinds[0], summary: "", followUpDate: "", followUpNote: "", followUpCompleted: false, hasFollowUp: false }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    dialog = useRef<HTMLDialogElement>(null);
  const activities = current.activities.slice().sort((a, b) => b.date.localeCompare(a.date));
  function openActivity(index: number | null) {
    const activity = index === null ? null : current.activities[index];
    setEditingIndex(index);
    setDraft(activity ? { ...activity, hasFollowUp: Boolean(activity.followUpDate || activity.followUpNote) } : { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), kind: contactActivityKinds[0], summary: "", followUpDate: "", followUpNote: "", followUpCompleted: false, hasFollowUp: false });
    setError("");
    requestAnimationFrame(() => dialog.current?.showModal());
  }
  function closeActivity() { dialog.current?.close(); setEditingIndex(null); }
  async function saveActivity() {
    if (!canEdit || !draft.summary.trim() || !draft.date) return;
    setBusy(true); setError("");
    try {
      const activity = { id: draft.id, date: draft.date, kind: draft.kind, summary: draft.summary.trim(), followUpDate: draft.hasFollowUp ? draft.followUpDate : "", followUpNote: draft.hasFollowUp ? draft.followUpNote.trim() : "", followUpCompleted: draft.hasFollowUp && draft.followUpCompleted };
      const activities = current.activities.slice();
      if (editingIndex === null) activities.push(activity); else activities[editingIndex] = activity;
      const next = activities.filter((item) => item.followUpDate && !item.followUpCompleted).sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))[0];
      const input = { kind: current.kind, name: current.name, email: current.email, phone: current.phone, website: current.website, organizationId: current.organizationId, relationships: current.relationships, activities, notes: current.notes, nextFollowUp: next?.followUpDate ?? "", followUpNote: next?.followUpNote ?? "", status: current.status };
      await inventoryRequest("/api/contacts?action=contact", { method: "PATCH", body: JSON.stringify({ id: current.id, revision: current.revision, operationId: crypto.randomUUID(), input }) });
      setCurrent({ ...current, activities, nextFollowUp: input.nextFollowUp, followUpNote: input.followUpNote, lastContactDate: activities.reduce((latest, item) => item.date > latest ? item.date : latest, ""), revision: current.revision + 1, updatedAt: new Date().toISOString() });
      closeActivity();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save this activity."); } finally { setBusy(false); }
  }
  return (
    <>
      <PageHeading
        eyebrow="CONTACTS / DETAIL"
        title={record.name}
        description="Relationship details and the private activity history for this contact."
        action={<Link className="button secondary" href="/admin/contacts">Back to contacts</Link>}
      />
      <div className="contact-detail-layout">
        <section className="inv-panel contact-profile-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{record.kind}</p>
              <h2>{record.name}</h2>
            </div>
            <Badge tone={record.status === "active" ? "green" : "neutral"}>{record.status}</Badge>
          </div>
          <dl className="contact-detail-list">
            <div><dt>Email</dt><dd>{record.email || "—"}</dd></div>
            <div><dt>Phone</dt><dd>{record.phone || "—"}</dd></div>
            <div><dt>Website</dt><dd>{record.website || "—"}</dd></div>
            <div><dt>Last activity</dt><dd>{record.lastContactDate || "None logged"}</dd></div>
            <div><dt>Next follow-up</dt><dd>{record.nextFollowUp || "None"}{record.followUpNote ? ` · ${record.followUpNote}` : ""}</dd></div>
          </dl>
          {!!record.relationships.length && <p className="field-hint">{record.relationships.map((item) => `${item.kind}${item.label ? ` — ${item.label}` : ""}`).join(" · ")}</p>}
          {record.notes && <p className="preserve-lines inv-description">{record.notes}</p>}
          {canEdit && <Link className="button secondary" href={`/admin/contacts?edit=${record.id}`}>Edit contact</Link>}
        </section>
        <section className="inv-panel contact-activity-panel">
          <div className="section-heading">
            <div><p className="eyebrow">HISTORY</p><h2>Activity log</h2></div>
            <div className="contact-activity-heading-actions"><span className="field-hint">{activities.length} {activities.length === 1 ? "entry" : "entries"}</span>{canEdit && <Button variant="secondary" onClick={() => openActivity(null)}><Plus size={15} aria-hidden="true" /> Log activity</Button>}</div>
          </div>
          {!activities.length ? <p className="empty-state">No activity has been logged for this contact.</p> : (
            <div className="table-scroll">
              <table className="contact-activity-table">
                <caption className="sr-only">Activity history for {record.name}</caption>
                <thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Details</th><th scope="col">Follow-up</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>{activities.map((activity) => (
                  <tr key={activity.id}>
                    <td>{activity.date}</td>
                    <td>{activityLabels[activity.kind]}</td>
                    <td className="preserve-lines">{activity.summary}<button className="contact-activity-edit" type="button" aria-label="Edit activity details" title="Edit activity" onClick={() => openActivity(current.activities.findIndex((item) => item.id === activity.id))}><Pencil size={14} aria-hidden="true" /></button></td>
                    <td>{activity.followUpDate ? <><div>{activity.followUpDate}<button className="contact-activity-edit" type="button" aria-label="Edit follow-up" title="Edit follow-up" onClick={() => openActivity(current.activities.findIndex((item) => item.id === activity.id))}><Pencil size={14} aria-hidden="true" /></button></div><small>{activity.followUpCompleted ? "Completed" : activity.followUpNote || "Open"}</small></> : "None"}</td>
                    <td><span className="sr-only">Edit</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <dialog ref={dialog} className="contact-detail-dialog">
        <button className="contact-dialog-close" type="button" aria-label="Close activity editor" onClick={closeActivity}><X size={18} aria-hidden="true" /></button>
        <div className="section-heading"><div><p className="eyebrow">{editingIndex === null ? "NEW ACTIVITY" : "EDIT ACTIVITY"}</p><h2>Activity</h2></div></div>
        {error && <p className="notice error" role="alert">{error}</p>}
        <fieldset disabled={!canEdit || busy} className="contact-detail-fields">
          <Input label="Date" type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
          <Select label="Type" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as typeof draft.kind })}>{contactActivityKinds.map((kind) => <option key={kind} value={kind}>{activityLabels[kind]}</option>)}</Select>
          <Textarea label="Details" rows={5} maxLength={2000} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} />
          <label className="activity-completed"><input type="checkbox" checked={draft.hasFollowUp} onChange={(event) => setDraft({ ...draft, hasFollowUp: event.target.checked })} /> Add follow-up</label>
          {draft.hasFollowUp && <><Input label="Follow-up date" type="date" value={draft.followUpDate} onChange={(event) => setDraft({ ...draft, followUpDate: event.target.value })} /><Textarea label="Follow-up details" rows={3} maxLength={1000} value={draft.followUpNote} onChange={(event) => setDraft({ ...draft, followUpNote: event.target.value })} /><label className="activity-completed"><input type="checkbox" checked={draft.followUpCompleted} onChange={(event) => setDraft({ ...draft, followUpCompleted: event.target.checked })} /> Follow-up completed</label></>}
        </fieldset>
        <div className="contact-detail-actions"><Button variant="ghost" onClick={closeActivity}>Close</Button><Button disabled={!canEdit || busy || !draft.summary.trim()} loading={busy} onClick={() => void saveActivity()}>Save activity</Button></div>
      </dialog>
    </>
  );
}
