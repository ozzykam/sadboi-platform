import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

export async function workspaceChecks({ request, csrf, ownerCookie, legalCookie, identity, signIn, session, db, check, origin }) {
  const read = (url, cookie = ownerCookie) => request(url, { headers: { Cookie: cookie } });
  async function write(action, input, cookie = ownerCookie, operationId = randomUUID()) {
    const proof = await csrf();
    return request("/api/workspace?action=" + action, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie + "; " + proof.cookie, "X-CSRF-Token": proof.token }, body: JSON.stringify({ input, operationId }) });
  }
  assert.equal((await request("/api/workspace")).status, 401); assert.equal((await read("/api/workspace", legalCookie)).status, 403); assert.equal((await read("/admin/settings", legalCookie)).status, 307); check("workspace access is limited to authenticated super admins");
  assert.equal((await request("/api/workspace?action=invite", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://attacker.example", Cookie: ownerCookie }, body: "{}" })).status, 403);
  assert.equal((await write("invite", { email: "workspace-invite@example.test", role: "accounting", note: "Quarterly review" })).status, 201);
  let directory = await (await read("/api/workspace")).json(), invite = directory.invites.find(item => item.email === "workspace-invite@example.test");
  assert.equal(invite.status, "pending"); assert.equal(invite.role, "accounting"); check("super admins can create bounded role-scoped invitations");
  assert.equal((await write("invite", { email: "workspace-invite@example.test", role: "accounting", note: "Duplicate" })).status, 409);
  assert.equal((await write("invite", { email: "workspace-invite@example.test", role: "super_admin", note: "Escalate" })).status, 400);
  assert.equal((await write("invite", { email: "not-an-email", role: "legal", note: "Bad" })).status, 400); check("invitations reject duplicates, unsupported roles, and invalid addresses");
  const firstInviteOp = randomUUID(), resend = { email: invite.email, expectedRevision: invite.revision, action: "resend", reason: "Sent instructions again" };
  assert.equal((await write("invite-status", resend, ownerCookie, firstInviteOp)).status, 201); assert.equal((await write("invite-status", resend, ownerCookie, firstInviteOp)).status, 201);
  directory = await (await read("/api/workspace")).json(); invite = directory.invites.find(item => item.email === "workspace-invite@example.test"); assert.equal(invite.revision, 2);
  assert.equal((await write("invite-status", { ...resend, reason: "Different payload" }, ownerCookie, firstInviteOp)).status, 409); check("resend is retry-safe and operation IDs cannot be reused for different input");
  assert.equal((await write("invite-status", { email: invite.email, expectedRevision: 1, action: "revoke", reason: "Stale" })).status, 409);
  assert.equal((await write("invite-status", { email: invite.email, expectedRevision: invite.revision, action: "revoke", reason: "No longer needed" })).status, 201);
  directory = await (await read("/api/workspace")).json(); invite = directory.invites.find(item => item.email === "workspace-invite@example.test"); assert.equal(invite.status, "revoked");
  assert.equal((await write("invite-status", { email: invite.email, expectedRevision: invite.revision, action: "resend", reason: "Try again" })).status, 409); check("revoked invitations cannot be resent or changed with stale revisions");

  const claimedEmail = "workspace-member@example.test"; assert.equal((await write("invite", { email: claimedEmail, role: "legal", note: "Rights review" })).status, 201);
  const member = await identity(claimedEmail, true), memberSession = await signIn(member); assert.equal(memberSession.status, 200); const memberCookie = session(memberSession);
  directory = await (await read("/api/workspace")).json(); let membership = directory.memberships.find(item => item.email === claimedEmail);
  assert.equal(membership.status, "active"); assert.equal(membership.role, "legal"); assert.equal(directory.invites.find(item => item.email === claimedEmail).status, "claimed"); check("verified invited users claim only their assigned role");
  assert.equal((await read("/api/workspace", memberCookie)).status, 403); assert.equal((await read("/admin/how-to", memberCookie)).status, 307);
  assert.equal((await write("membership", { userId: membership.userId, expectedRevision: membership.revision, action: "revoke", reason: "Rights review complete" })).status, 201);
  assert.equal((await read("/api/workspace", memberCookie)).status, 401); assert.equal((await request("/api/auth/session", { headers: { Cookie: memberCookie } })).status, 401); check("revoking a membership invalidates the existing session");
  directory = await (await read("/api/workspace")).json(); membership = directory.memberships.find(item => item.email === claimedEmail);
  assert.equal((await write("membership", { userId: membership.userId, expectedRevision: membership.revision - 1, action: "reactivate", reason: "Stale" })).status, 409);
  assert.equal((await write("membership", { userId: membership.userId, expectedRevision: membership.revision, action: "reactivate", reason: "Rights review resumed" })).status, 201); directory = await (await read("/api/workspace")).json(); membership = directory.memberships.find(item => item.email === claimedEmail); assert.equal(membership.status, "active"); assert.equal(membership.role, "legal"); check("reactivation is revision-checked and restores the same role");
  const audit = await db.collection("businesses/sadboi/workspaceAudit").get(); assert.ok(audit.docs.some(doc => doc.data().kind === "invite_created" && doc.data().recordId === createHash("sha256").update(claimedEmail).digest("hex"))); assert.ok(audit.docs.some(doc => doc.data().kind === "membership_revoke" && doc.data().recordId === membership.userId)); check("workspace changes retain actor-linked audit records");
}
