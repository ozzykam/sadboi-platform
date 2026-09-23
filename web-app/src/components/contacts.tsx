"use client";
import { useState } from "react";
import Link from "next/link";
import type { ContactRecord, ContactsDirectory } from "@sadboi/core";
import { inventoryRequest } from "@/lib/inventory-client";
import { Badge, Button, PageHeading } from "./ui";
import { Input, InventoryForm, Select, Status, value } from "./inventory-form";
const relationshipKinds = [
  "client",
  "collector",
  "gallery",
  "licensee",
  "printer",
  "supplier",
  "collaborator",
  "patron",
  "other",
] as const;
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
    [kind, setKind] = useState(record?.kind ?? "person");
  const rows = [0, 1, 2];
  return (
    <InventoryForm
      endpoint="/api/contacts"
      action="contact"
      record={baseline}
      label="Save contact"
      successMessage="Contact saved."
      again={false}
      onSaved={onSaved}
      prepare={(data) => ({
        kind: value(data, "kind"),
        name: value(data, "name"),
        email: value(data, "email"),
        phone: value(data, "phone"),
        website: value(data, "website"),
        organizationId: value(data, "organizationId"),
        relationships: rows
          .map((index) => ({
            kind: value(data, "relationship-kind-" + index),
            label: value(data, "relationship-label-" + index),
          }))
          .filter((item) => item.kind && item.label),
        notes: value(data, "notes"),
        nextFollowUp: value(data, "nextFollowUp"),
        followUpNote: value(data, "followUpNote"),
        status: value(data, "status"),
      })}
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
        type="url"
        maxLength={500}
        defaultValue={baseline?.website}
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
      <div className="inv-wide">
        <p className="field-hint">
          Add up to three relationship labels. Use the same contact for multiple
          roles, such as a gallery that is also a collaborator.
        </p>
      </div>
      {rows.map((index) => (
        <div className="field-grid inv-wide" key={index}>
          <Select
            label={`Relationship ${index + 1}`}
            name={`relationship-kind-${index}`}
            defaultValue={baseline?.relationships[index]?.kind ?? ""}
          >
            <option value="">None</option>
            {relationshipKinds.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Input
            label="Relationship label"
            name={`relationship-label-${index}`}
            maxLength={120}
            defaultValue={baseline?.relationships[index]?.label}
            placeholder="Primary contact"
          />
        </div>
      ))}
      <Input
        label="Internal notes"
        name="notes"
        maxLength={3000}
        defaultValue={baseline?.notes}
      />
      <Input
        label="Next follow-up date (optional)"
        name="nextFollowUp"
        type="date"
        defaultValue={baseline?.nextFollowUp}
      />
      <Input
        label="Follow-up note"
        name="followUpNote"
        maxLength={1000}
        defaultValue={baseline?.followUpNote}
        placeholder="Ask about booth availability"
      />
      <Status initial={baseline?.status} />
      <p className="field-hint inv-wide">
        Contacts are internal records. Notes and follow-up details are not sent
        to the person or organization.
      </p>
    </InventoryForm>
  );
}
function Card({
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
  const [directory, setDirectory] = useState(initial),
    [kind, setKind] = useState<"all" | "person" | "organization">("all"),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
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
        title="Keep the people around the work close."
        description="People, organizations, roles, notes, and the next conversation."
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
        Need a walkthrough?{" "}
        <Link className="inline-link" href="/admin/how-to#contacts">
          Learn how to use contacts
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
          <div className="inv-cards">
            {records.map((record) => (
              <Card
                key={record.id}
                record={record}
                canEdit={canEdit}
                directory={directory}
                onEdit={() => setEditing(record.id)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
