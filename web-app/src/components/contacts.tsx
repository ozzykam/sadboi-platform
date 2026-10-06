"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { contactActivityKinds, type ContactActivity, contactRelationshipKinds, type ContactRecord, type ContactsDirectory } from "@sadboi/core";
import { Eye, Plus, Trash2, Lightbulb } from "lucide-react";
import { inventoryRequest } from "@/lib/inventory-client";
import { Badge, Button, PageHeading } from "./ui";
import { Input, InventoryForm, Select, Status, Textarea, value } from "./inventory-form";
type RelationshipDraft = { id: string; kind: string; label: string };
type ActivityDraft = ContactActivity & { hasFollowUp: boolean };
const activityLabels: Record<(typeof contactActivityKinds)[number], string> = {
  email: "Email",
  call: "Call",
  meeting: "Meeting",
  message: "Message",
  note: "Note",
  other: "Other",
};
type DetailKind = "last" | "followup";
type ContactDetail = { record: ContactRecord; kind: DetailKind; activityIndex: number };
function openFollowUp(activities: ContactActivity[]) {
  return activities
    .map((activity, index) => ({ activity, index }))
    .filter(({ activity }) => activity.followUpDate && !activity.followUpCompleted)
    .sort((a, b) => a.activity.followUpDate.localeCompare(b.activity.followUpDate))[0];
}
function ContactEditor({
  record,
  directory,
  onSaved,
}: {
  record?: ContactRecord;
  directory: ContactsDirectory;
  onSaved: (id: string) => Promise<void>;
}) {
  const [baseline] = useState(record),
    [kind, setKind] = useState(record?.kind ?? "person"),
    [relationships, setRelationships] = useState<RelationshipDraft[]>(
      record?.relationships.length
        ? record.relationships.map((relationship, index) => ({ ...relationship, id: `relationship-${index}` }))
        : [{ id: "relationship-0", kind: "", label: "" }],
    ),
    [activities, setActivities] = useState<ActivityDraft[]>(
      (record?.activities ?? []).map((activity) => ({
        ...activity,
        hasFollowUp: Boolean(activity.followUpDate || activity.followUpNote),
      })),
    );
  return (
    <InventoryForm
      endpoint="/api/contacts"
      action="contact"
      record={baseline}
      label="Save contact"
      successMessage="Contact saved."
      again={false}
      onSaved={onSaved}
      prepare={(data) => {
        const loggedActivities = activities
          .map((activity, index) => ({
            id: activity.id,
            date: value(data, "activity-date-" + index),
            kind: value(data, "activity-kind-" + index),
            summary: value(data, "activity-summary-" + index),
            followUpDate: data.get("activity-has-follow-up-" + index) === "on" ? value(data, "activity-follow-up-date-" + index) : "",
            followUpNote: data.get("activity-has-follow-up-" + index) === "on" ? value(data, "activity-follow-up-note-" + index) : "",
            followUpCompleted: data.get("activity-has-follow-up-" + index) === "on" && data.get("activity-follow-up-completed-" + index) === "on",
          }))
          .filter((activity) => activity.summary && activity.date);
        const nextActivity = loggedActivities
          .filter((activity) => activity.followUpDate && !activity.followUpCompleted)
          .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))[0];
        return {
          kind: value(data, "kind"),
          name: value(data, "name"),
          email: value(data, "email"),
          phone: value(data, "phone"),
          website: value(data, "website"),
          organizationId: value(data, "organizationId"),
          relationships: relationships
            .map((_, index) => ({
              kind: value(data, "relationship-kind-" + index),
              label: value(data, "relationship-label-" + index),
            }))
            .filter((item) => item.kind && item.label),
          activities: loggedActivities,
          notes: value(data, "notes"),
          nextFollowUp: nextActivity?.followUpDate ?? (loggedActivities.length ? "" : baseline?.nextFollowUp ?? ""),
          followUpNote: nextActivity?.followUpNote ?? (loggedActivities.length ? "" : baseline?.followUpNote ?? ""),
          status: value(data, "status"),
        };
      }}
    >
      <Select
        label="Record type"
        name="kind"
        value={kind}
        onChange={(event) =>
          setKind(event.target.value as "person" | "organization")
        }
      >
        <option value="person">Person</option>
        <option value="organization">Organization</option>
      </Select>
      <Input
        label={kind === "organization" ? "Organization name" : "Person name"}
        name="name"
        required
        maxLength={200}
        defaultValue={baseline?.name}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        maxLength={254}
        defaultValue={baseline?.email}
      />
      <Input
        label="Phone"
        name="phone"
        maxLength={80}
        defaultValue={baseline?.phone}
      />
      <Input
        label="Website"
        name="website"
        type="text"
        inputMode="url"
        maxLength={500}
        defaultValue={baseline?.website}
        placeholder="example.com or https://example.com"
        helperText="You can enter a domain with or without http:// or https://."
        pattern="^(https?:\/\/)?(www\.)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$"
      />
      {kind === "person" && (
        <Select
          label="Organization (optional)"
          name="organizationId"
          defaultValue={baseline?.organizationId ?? ""}
        >
          <option value="">No organization</option>
          {directory.contacts
            .filter(
              (item) =>
                item.kind === "organization" && item.status === "active",
            )
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </Select>
      )}
      <div className="inv-wide relationship-editor-heading">
        <div>
          <p className="field-label">Relationships</p>
          <p className="field-hint">
            Add one or more roles for this contact, such as gallery and collaborator.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setRelationships((current) => [
              ...current,
              { id: crypto.randomUUID(), kind: "", label: "" },
            ])
          }
          aria-label="Add relationship"
          title="Add relationship"
        >
          <Plus size={16} aria-hidden="true" />
          Add relationship
        </Button>
      </div>
      {relationships.map((relationship, index) => (
        <div className="field-grid inv-wide relationship-row" key={relationship.id}>
          <Select
            label="Relationship type"
            name={`relationship-kind-${index}`}
            defaultValue={relationship.kind}
          >
            <option value="">None</option>
            {contactRelationshipKinds.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Input
            label="Relationship label"
            name={`relationship-label-${index}`}
            maxLength={120}
            defaultValue={relationship.label}
            placeholder="Primary contact"
          />
          {relationships.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              className="relationship-remove"
              onClick={() =>
                setRelationships((current) => current.filter((_, row) => row !== index))
              }
              aria-label={`Remove relationship ${index + 1}`}
              title="Remove relationship"
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          )}
        </div>
      ))}
      <div className="inv-wide activity-editor-heading">
        <div>
          <p className="field-label">Correspondence and activity history</p>
          <p className="field-hint">
            Log emails, calls, meetings, or notes. Follow-ups stay attached to the activity that created them.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setActivities((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                date: new Date().toISOString().slice(0, 10),
                kind: "email",
                summary: "",
                followUpDate: "",
                followUpNote: "",
                followUpCompleted: false,
                hasFollowUp: false,
              },
            ])
          }
          aria-label="Log activity"
          title="Log activity"
        >
          <Plus size={16} aria-hidden="true" />
          Log activity
        </Button>
      </div>
      {!!activities.length && (
        <div className="inv-wide activity-list">
          {activities.map((activity, index) => (
            <div className="activity-row" key={activity.id}>
              <div className="activity-row-fields">
                <Input label="Date" name={`activity-date-${index}`} type="date" defaultValue={activity.date} />
                <Select label="Type" name={`activity-kind-${index}`} defaultValue={activity.kind}>
                  {contactActivityKinds.map((kind) => (
                    <option key={kind} value={kind}>{activityLabels[kind]}</option>
                  ))}
                </Select>
                <Textarea label="Details" name={`activity-summary-${index}`} defaultValue={activity.summary} rows={3} maxLength={2000} placeholder="What happened?" />
                <label className="activity-completed activity-follow-up-toggle">
                  <input
                    type="checkbox"
                    name={`activity-has-follow-up-${index}`}
                    defaultChecked={activity.hasFollowUp}
                    onChange={(event) => setActivities((current) => current.map((item) => item.id === activity.id ? { ...item, hasFollowUp: event.target.checked } : item))}
                  />
                  Add follow-up
                </label>
                {activity.hasFollowUp && (
                  <>
                    <Input label="Follow-up date" name={`activity-follow-up-date-${index}`} type="date" defaultValue={activity.followUpDate} />
                    <Input label="Follow-up details" name={`activity-follow-up-note-${index}`} defaultValue={activity.followUpNote} maxLength={1000} placeholder="What should happen next?" />
                    <label className="activity-completed"><input type="checkbox" name={`activity-follow-up-completed-${index}`} defaultChecked={activity.followUpCompleted} /> Follow-up completed</label>
                  </>
                )}
              </div>
              <Button type="button" variant="ghost" className="relationship-remove" onClick={() => setActivities((current) => current.filter((item) => item.id !== activity.id))} aria-label={`Remove activity ${index + 1}`} title="Remove activity">
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Textarea
        label="Internal notes"
        name="notes"
        maxLength={3000}
        defaultValue={baseline?.notes}
        rows={6}
        placeholder="Context, history, or details to remember"
      />
      <Status initial={baseline?.status} />
      <p className="field-hint inv-wide">
        Contacts are internal records. Notes and follow-up details are not sent
        to the person or organization.
      </p>
    </InventoryForm>
  );
}
export function Card({
  record,
  canEdit,
  directory,
  onEdit,
}: {
  record: ContactRecord;
  canEdit: boolean;
  directory: ContactsDirectory;
  onEdit: () => void;
}) {
  const organization = directory.contacts.find(
    (item) => item.id === record.organizationId,
  );
  return (
    <article className="inv-panel">
      <div className="section-heading">
        <div>
          <h2>{record.name}</h2>
          <p className="field-hint">
            {record.kind}
            {organization ? " · " + organization.name : ""}
          </p>
        </div>
        <Badge tone={record.status === "active" ? "green" : "neutral"}>
          {record.status}
        </Badge>
      </div>
      <p className="inv-description">
        {[record.email, record.phone, record.website]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="field-hint">Last activity {record.lastContactDate || "not logged"}</p>
      {!!record.relationships.length && (
        <p className="field-hint">
          {record.relationships
            .map((item) => item.kind + (item.label ? " — " + item.label : ""))
            .join(" · ")}
        </p>
      )}
      {record.nextFollowUp && (
        <p className="field-hint">
          Follow up {record.nextFollowUp}
          {record.followUpNote ? " · " + record.followUpNote : ""}
        </p>
      )}
      {record.notes && (
        <p className="preserve-lines inv-description">{record.notes}</p>
      )}
      {canEdit && (
        <Button variant="secondary" onClick={onEdit}>
          Edit contact
        </Button>
      )}
    </article>
  );
}
export function Contacts({
  initial,
  canEdit,
}: {
  initial: ContactsDirectory;
  canEdit: boolean;
}) {
  const searchParams = useSearchParams();
  const [directory, setDirectory] = useState(initial),
    [kind, setKind] = useState<"all" | "person" | "organization">("all"),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<string | null>(() => searchParams.get("edit")),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [detail, setDetail] = useState<ContactDetail | null>(null),
    [detailDraft, setDetailDraft] = useState<ContactActivity | null>(null),
    [detailDirty, setDetailDirty] = useState(false),
    [detailBusy, setDetailBusy] = useState(false),
    [detailError, setDetailError] = useState(""),
    detailDialog = useRef<HTMLDialogElement>(null);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setDirectory(await inventoryRequest("/api/contacts"));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not refresh contacts.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saved() {
    setEditing(null);
    await refresh();
  }
  function openDetail(record: ContactRecord, kind: DetailKind) {
    const selected = kind === "last"
      ? record.activities
          .map((activity, index) => ({ activity, index }))
          .sort((a, b) => b.activity.date.localeCompare(a.activity.date))[0]
      : openFollowUp(record.activities);
    if (!selected) return;
    setDetail({ record, kind, activityIndex: selected.index });
    setDetailDraft({ ...selected.activity });
    setDetailDirty(false);
    setDetailError("");
    requestAnimationFrame(() => detailDialog.current?.showModal());
  }
  function closeDetail() {
    detailDialog.current?.close();
    setDetail(null);
    setDetailDraft(null);
    setDetailDirty(false);
    setDetailError("");
  }
  async function updateDetail() {
    if (!canEdit || !detail || !detailDraft || !detailDirty) return;
    setDetailBusy(true);
    setDetailError("");
    try {
      const activities = detail.record.activities.map((activity, index) =>
        index === detail.activityIndex ? detailDraft : activity,
      );
      const next = openFollowUp(activities)?.activity;
      const { id, revision } = detail.record;
      const input = {
        kind: detail.record.kind,
        name: detail.record.name,
        email: detail.record.email,
        phone: detail.record.phone,
        website: detail.record.website,
        organizationId: detail.record.organizationId,
        relationships: detail.record.relationships,
        notes: detail.record.notes,
        status: detail.record.status,
      };
      await inventoryRequest("/api/contacts?action=contact", {
        method: "PATCH",
        body: JSON.stringify({
          id,
          revision,
          operationId: crypto.randomUUID(),
          input: {
            ...input,
            activities,
            nextFollowUp: next?.followUpDate ?? "",
            followUpNote: next?.followUpNote ?? "",
          },
        }),
      });
      await refresh();
      closeDetail();
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Could not update this detail.");
    } finally {
      setDetailBusy(false);
    }
  }
  const records = directory.contacts.filter(
    (item) =>
      (kind === "all" || item.kind === kind) &&
      (
        item.name +
        " " +
        item.email +
        " " +
        item.relationships.map((rel) => rel.kind + " " + rel.label).join(" ")
      )
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="CONTACTS / RELATIONSHIPS"
        title="Homies, collaborators, supporters, & partners"
        action={
          <Button variant="secondary" disabled={busy} onClick={refresh}>
            {busy ? "Refreshing..." : "Refresh contacts"}
          </Button>
        }
      />
      {!canEdit && (
        <p className="notice">
          Read-only access: you can view contact relationships and follow-ups,
          but only super admins can edit them.
        </p>
      )}
      <p className="howto-context">
        <Link className="inline-link howto-link" href="/admin/how-to#contacts">
          <Lightbulb size={14} /> How to use contacts
        </Link>
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {editing ? (
        <section className="inv-panel">
          <div className="section-heading">
            <h2>{editing === "new" ? "Add contact" : "Edit contact"}</h2>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Close editor
            </Button>
          </div>
          <ContactEditor
            record={directory.contacts.find((item) => item.id === editing)}
            directory={directory}
            onSaved={saved}
          />
        </section>
      ) : (
        <>
          <div className="inv-toolbar">
            <Input
              label="Search contacts, organizations, or relationships"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="inv-actions">
              <Select
                label="Show"
                value={kind}
                onChange={(event) => setKind(event.target.value as typeof kind)}
              >
                <option value="all">Everyone</option>
                <option value="person">People</option>
                <option value="organization">Organizations</option>
              </Select>
              {canEdit && (
                <Button onClick={() => setEditing("new")}>Add contact</Button>
              )}
            </div>
          </div>
          {!records.length && (
            <div className="empty-state roomy">
              <h2>
                {directory.contacts.length
                  ? "No matching contacts."
                  : "Start your relationship directory."}
              </h2>
              <p>
                Record a printer, gallery, client, collaborator, or organization
                before the next conversation.
              </p>
            </div>
          )}
          <div className="table-scroll inbox-table-wrap contacts-table-wrap">
              <table className="inbox-table contacts-table">
                <caption className="sr-only">Contacts directory</caption>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Type</th>
                    <th scope="col">Organization</th>
                    <th scope="col">Contact details</th>
                    <th scope="col">Relationships</th>
                    <th scope="col">Last activity</th>
                    <th scope="col">Next follow-up</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => {
                    const organization = directory.contacts.find(
                      (item) => item.id === record.organizationId,
                    );
                    const lastActivity = record.activities
                      .slice()
                      .sort((a, b) => b.date.localeCompare(a.date))[0];
                    const open = openFollowUp(record.activities)?.activity;
                    const nextFollowUp = record.activities.length
                      ? open
                      : record.nextFollowUp
                        ? { followUpDate: record.nextFollowUp, followUpNote: record.followUpNote }
                        : undefined;
                    return (
                      <tr key={record.id}>
                        <th scope="row">{record.name}</th>
                        <td>{record.kind}</td>
                        <td>{organization?.name || "—"}</td>
                        <td>
                          <div>{record.email || "—"}</div>
                          {record.phone && <small>{record.phone}</small>}
                          {record.website && <small>{record.website}</small>}
                        </td>
                        <td>
                          {record.relationships.length
                            ? record.relationships
                                .map((item) => item.kind + (item.label ? " — " + item.label : ""))
                                .join(" · ")
                            : "—"}
                        </td>
                        <td>
                          <div className="last-contact-info">
                            <div>
                              <span>{lastActivity?.date || record.lastContactDate || "—"}</span>
                            {record.lastContactDate && (
                              <button
                                type="button"
                                className="contact-view-button"
                                aria-label={`View last activity for ${record.name}`}
                                title="View last activity"
                                onClick={() => openDetail(record, "last")}
                              >
                                <Eye size={15} aria-hidden="true" />
                              </button>
                            )}
                              {lastActivity && (
                                <span className="contact-cell-details">
                                  <span className="contact-cell-text">{lastActivity.summary}</span>

                                </span>
                              )}

                            </div>
                          </div>
                        </td>
                        <td>
                          {nextFollowUp ? (
                            <>
                            <div className="follow-up-info">
                              <div>
                                <span>{nextFollowUp.followUpDate}</span>
                                {open && (
                                  <button
                                    type="button"
                                    className="contact-view-button"
                                    aria-label={`View next follow-up for ${record.name}`}
                                    title="View next follow-up"
                                    onClick={() => openDetail(record, "followup")}
                                  >
                                    <Eye size={15} aria-hidden="true" />
                                  </button>
                                )}
                                {open && (
                                  <span className="contact-cell-details">
                                    <span className="contact-cell-text">{open.followUpNote || "Follow-up details"}</span>

                                  </span>
                                )}
                              </div>
                            </div>
                            </>
                          ) : "none"}
                        </td>
                        <td>
                          <Badge tone={record.status === "active" ? "green" : "neutral"}>
                            {record.status}
                          </Badge>
                        </td>
                        <td>
                            <Link className="button ghost" href={`/admin/contacts/${record.id}`}>View</Link>
                            {canEdit && (
                            <Button variant="ghost" onClick={() => setEditing(record.id)}>
                              Edit
                            </Button>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
          <dialog
            ref={detailDialog}
            className="contact-detail-dialog"
            onClose={() => {
              setDetail(null);
              setDetailDraft(null);
              setDetailDirty(false);
            }}
          >
            {detail && detailDraft && (
              <>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">{detail.kind === "last" ? "LAST ACTIVITY" : "NEXT FOLLOW-UP"}</p>
                    <h2>{detail.record.name}</h2>
                  </div>
                  <Button variant="ghost" onClick={closeDetail}>Close</Button>
                </div>
                {detailError && <p className="notice error" role="alert">{detailError}</p>}
                {detail.kind === "followup" && (
                  <div className="contact-source-activity">
                    <p className="field-hint">
                      Activity: {activityLabels[detailDraft.kind]} on {detailDraft.date}
                    </p>
                    <p className="preserve-lines">{detailDraft.summary}</p>
                  </div>
                )}
                <fieldset disabled={!canEdit || detailBusy} className="contact-detail-fields">
                  {detail.kind === "last" ? (
                    <>
                      <Input
                        label="Date"
                        type="date"
                        value={detailDraft.date}
                        onChange={(event) => {
                          setDetailDraft({ ...detailDraft, date: event.target.value });
                          setDetailDirty(true);
                        }}
                      />
                      <Select
                        label="Type"
                        value={detailDraft.kind}
                        onChange={(event) => {
                          setDetailDraft({ ...detailDraft, kind: event.target.value as ContactActivity["kind"] });
                          setDetailDirty(true);
                        }}
                      >
                        {contactActivityKinds.map((kind) => <option key={kind} value={kind}>{activityLabels[kind]}</option>)}
                      </Select>
                      <Textarea
                        label="Details"
                        rows={5}
                        maxLength={2000}
                        value={detailDraft.summary}
                        onChange={(event) => {
                          setDetailDraft({ ...detailDraft, summary: event.target.value });
                          setDetailDirty(true);
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <Input
                        label="Follow-up date"
                        type="date"
                        value={detailDraft.followUpDate}
                        onChange={(event) => {
                          setDetailDraft({ ...detailDraft, followUpDate: event.target.value });
                          setDetailDirty(true);
                        }}
                      />
                      <Textarea
                        label="Follow-up details"
                        rows={5}
                        maxLength={1000}
                        value={detailDraft.followUpNote}
                        onChange={(event) => {
                          setDetailDraft({ ...detailDraft, followUpNote: event.target.value });
                          setDetailDirty(true);
                        }}
                      />
                      <label className="activity-completed">
                        <input
                          type="checkbox"
                          checked={detailDraft.followUpCompleted}
                          onChange={(event) => {
                            setDetailDraft({ ...detailDraft, followUpCompleted: event.target.checked });
                            setDetailDirty(true);
                          }}
                        />
                        Follow-up completed
                      </label>
                    </>
                  )}
                </fieldset>
                <div className="contact-detail-actions">
                  <Button variant="ghost" onClick={closeDetail}>Close</Button>
                  {detail.kind === "followup" && canEdit && (
                    <Button
                      variant="ghost"
                      disabled={detailBusy}
                      onClick={() => {
                        setDetailDraft({ ...detailDraft, followUpDate: "", followUpNote: "", followUpCompleted: false });
                        setDetailDirty(true);
                      }}
                    >
                      Remove follow-up
                    </Button>
                  )}
                  <Button disabled={!canEdit || !detailDirty || detailBusy} loading={detailBusy} onClick={() => void updateDetail()}>
                    Update
                  </Button>
                </div>
              </>
            )}
          </dialog>
        </>
      )}
    </>
  );
}
