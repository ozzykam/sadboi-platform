"use client";
import { useState } from "react";
import type {
  StaffDirectory,
  StaffInviteRecord,
  StaffMembershipRecord,
} from "@sadboi/core";
import { inventoryRequest } from "@/lib/inventory-client";
import { Badge, Button, PageHeading } from "./ui";
import { Input, InventoryForm, Select, value } from "./inventory-form";

function InviteForm({ onSaved }: { onSaved: (id: string) => Promise<void> }) {
  return (
    <InventoryForm
      endpoint="/api/workspace"
      action="invite"
      label="Create invitation"
      successMessage="Invitation saved. Share the email address and sign-in instructions with the person."
      again={false}
      onSaved={onSaved}
      prepare={(data) => ({
        email: value(data, "email"),
        role: value(data, "role"),
        note: value(data, "note"),
      })}
    >
      <Input
        label="Staff email"
        name="email"
        type="email"
        required
        maxLength={254}
        placeholder="accounting@example.com"
      />
      <Select label="Role" name="role" defaultValue="accounting">
        <option value="accounting">
          Accounting — finance and read-only operations
        </option>
        <option value="legal">Legal — agreements and rights</option>
      </Select>
      <Input
        label="Invitation note (optional)"
        name="note"
        maxLength={1000}
        placeholder="Why this person needs access"
      />
      <p className="field-hint inv-wide">
        This creates a pending, role-scoped invitation. The person still creates
        their own Firebase account, verifies their email, and signs in. This
        screen does not send email.
      </p>
    </InventoryForm>
  );
}
function ActionForm({
  kind,
  record,
  onSaved,
}: {
  kind: "invite" | "membership";
  record: StaffInviteRecord | StaffMembershipRecord;
  onSaved: (id: string) => Promise<void>;
}) {
  const isInvite = kind === "invite",
    [action, setAction] = useState<"revoke" | "reactivate" | "resend">(
      isInvite
        ? "resend"
        : record.status === "active"
          ? "revoke"
          : "reactivate",
    );
  const endpointAction = isInvite ? "invite-status" : "membership";
  const userId = isInvite ? "" : (record as StaffMembershipRecord).userId;
  return (
    <InventoryForm
      endpoint="/api/workspace"
      action={endpointAction}
      label={
        action === "resend"
          ? "Record resend"
          : action === "revoke"
            ? "Revoke access"
            : "Reactivate access"
      }
      successMessage="Workspace access updated."
      again={false}
      onSaved={onSaved}
      prepare={(data) => ({
        ...(isInvite
          ? { email: record.email, expectedRevision: record.revision }
          : { userId, expectedRevision: record.revision }),
        action,
        reason: value(data, "reason"),
      })}
    >
      {!isInvite && (
        <Select
          label="Action"
          value={action}
          onChange={(event) => setAction(event.target.value as typeof action)}
        >
          <option value="revoke">Revoke membership</option>
          <option value="reactivate">Reactivate membership</option>
        </Select>
      )}
      {isInvite && record.status === "pending" && (
        <Select
          label="Invitation action"
          value={action}
          onChange={(event) => setAction(event.target.value as typeof action)}
        >
          <option value="resend">Record resend</option>
          <option value="revoke">Revoke invitation</option>
        </Select>
      )}
      <Input
        label="Reason / note"
        name="reason"
        required
        minLength={3}
        maxLength={1000}
        placeholder={
          action === "resend"
            ? "Sent the sign-in instructions again"
            : action === "revoke"
              ? "No longer needs workspace access"
              : "Access restored for current project"
        }
      />
      <p className="field-hint inv-wide">
        {action === "resend"
          ? "Email delivery is handled outside this screen. Recording a resend keeps the access history clear."
          : action === "revoke"
            ? "Revocation takes effect on the next protected request and invalidates active Firebase sessions for this membership."
            : "Reactivation restores this existing membership; it does not create a new invitation or change the role."}
      </p>
    </InventoryForm>
  );
}
function MembershipCard({
  record,
  onSaved,
}: {
  record: StaffMembershipRecord;
  onSaved: (id: string) => Promise<void>;
}) {
  return (
    <article className="inv-panel">
      <div className="section-heading">
        <div>
          <h3>{record.email}</h3>
          <p className="field-hint">
            {record.role.replace("_", " ")} · user {record.userId}
          </p>
        </div>
        <Badge tone={record.status === "active" ? "green" : "red"}>
          {record.status}
        </Badge>
      </div>
      {record.role !== "super_admin" && (
        <ActionForm kind="membership" record={record} onSaved={onSaved} />
      )}
      {record.role === "super_admin" && (
        <p className="field-hint">
          Super-admin membership. Manage through the approved
          bootstrap/deployment process.
        </p>
      )}
    </article>
  );
}
function InviteCard({
  record,
  onSaved,
}: {
  record: StaffInviteRecord;
  onSaved: (id: string) => Promise<void>;
}) {
  return (
    <article className="inv-panel">
      <div className="section-heading">
        <div>
          <h3>{record.email}</h3>
          <p className="field-hint">
            {record.role} · revision {record.revision}
          </p>
        </div>
        <Badge
          tone={
            record.status === "pending"
              ? "gold"
              : record.status === "claimed"
                ? "green"
                : "red"
          }
        >
          {record.status}
        </Badge>
      </div>
      {record.note && <p className="inv-description">{record.note}</p>}
      {record.status === "pending" && (
        <ActionForm kind="invite" record={record} onSaved={onSaved} />
      )}
    </article>
  );
}
export function Workspace({ initial }: { initial: StaffDirectory }) {
  const [directory, setDirectory] = useState(initial),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [showInvite, setShowInvite] = useState(false);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setDirectory(await inventoryRequest("/api/workspace"));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not refresh workspace access.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saved() {
    setShowInvite(false);
    await refresh();
  }
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE / ACCESS"
        title="Who can enter the studio?"
        description="Manage role-scoped invitations and memberships. Access changes are recorded for review."
        action={
          <Button variant="secondary" onClick={refresh} disabled={busy}>
            {busy ? "Refreshing..." : "Refresh access"}
          </Button>
        }
      />
      <div className="howto-context">
        Need instructions?{" "}
        <a className="inline-link" href="/admin/how-to#workspace">
          Read the Workspace access guide
        </a>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <section className="inv-panel">
        <div className="section-heading">
          <div>
            <h2>Invite scoped staff</h2>
            <p className="field-hint">
              Legal and accounting access is granted by role. Super admins are
              provisioned separately.
            </p>
          </div>
          {!showInvite && (
            <Button onClick={() => setShowInvite(true)}>
              Create invitation
            </Button>
          )}
        </div>
        {showInvite && <InviteForm onSaved={saved} />}
      </section>
      <section className="inv-section">
        <h2>Memberships</h2>
        <p className="inv-description">
          Active members can use their assigned areas. Revoked members remain in
          history and can be reactivated by a super admin.
        </p>
        <div className="inv-cards">
          {directory.memberships.map((record) => (
            <MembershipCard
              key={record.userId}
              record={record}
              onSaved={saved}
            />
          ))}
        </div>
      </section>
      <section className="inv-section">
        <h2>Invitations</h2>
        <p className="inv-description">
          Pending invitations are not accounts and do not grant access until the
          person verifies their email and signs in.
        </p>
        <div className="inv-cards">
          {directory.invites.map((record) => (
            <InviteCard key={record.id} record={record} onSaved={saved} />
          ))}
        </div>
      </section>
    </>
  );
}
