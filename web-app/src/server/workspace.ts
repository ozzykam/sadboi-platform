import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import {
  staffInviteInputSchema,
  staffInviteActionSchema,
  staffMembershipActionSchema,
  type StaffDirectory,
  type StaffInviteRecord,
  type StaffMembershipRecord,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import {
  AccessError,
  businessId,
  cookieName,
  staffForCookie,
  type Staff,
} from "./staff";
import { ensureStaffMode } from "./auth-http";

const root = () => adminServices().db.doc("businesses/" + businessId);
const collection = (name: string) => root().collection(name);
const emailId = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
function fail(message: string, status = 409): never {
  throw new AccessError(status, "workspace", message);
}
function parsed<T>(
  schema: {
    safeParse(value: unknown): {
      success: boolean;
      data?: T;
      error?: { issues: { message: string }[] };
    };
  },
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success)
    fail(result.error!.issues.map((issue) => issue.message).join(" "), 400);
  return result.data!;
}
function bodyKeys(body: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    fail("Unexpected workspace fields.", 400);
}
function operationId(body: Record<string, unknown>) {
  if (
    typeof body.operationId !== "string" ||
    !/^[a-f0-9-]{20,100}$/i.test(body.operationId)
  )
    fail("A valid operation ID is required.", 400);
  return body.operationId;
}
function timestamp(value: unknown): string {
  return typeof value === "string"
    ? value
    : value && typeof (value as { toDate?: () => Date }).toDate === "function"
      ? (value as { toDate: () => Date }).toDate().toISOString()
      : "";
}
async function workspaceStaff(): Promise<Staff> {
  ensureStaffMode();
  const staff = await staffForCookie(
    (await cookies()).get(cookieName("session"))?.value,
  );
  if (!staff)
    throw new AccessError(
      401,
      "sign-in",
      "Your session has ended. Sign in again to continue.",
    );
  if (staff.role !== "super_admin")
    throw new AccessError(
      403,
      "forbidden",
      "Only super admins can manage workspace access.",
    );
  return staff;
}
function inviteProjection(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
): StaffInviteRecord {
  const data = doc.data();
  return {
    id: doc.id,
    email: data.email,
    role: data.role,
    note: data.note ?? "",
    status: data.status,
    revision: data.revision ?? 1,
    createdAt: timestamp(data.createdAt),
    updatedAt: timestamp(data.updatedAt) || timestamp(data.createdAt),
    claimedBy: data.claimedBy ?? null,
  };
}
function membershipProjection(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
): StaffMembershipRecord {
  const data = doc.data();
  return {
    userId: doc.id,
    email: data.email,
    role: data.role,
    status: data.status,
    revision: data.revision ?? 1,
    createdAt: timestamp(data.createdAt),
    updatedAt: timestamp(data.updatedAt) || timestamp(data.createdAt),
  };
}
export async function workspaceDirectory(): Promise<StaffDirectory> {
  const [invites, memberships] = await Promise.all([
    collection("staffInvites").limit(101).get(),
    collection("memberships").limit(101).get(),
  ]);
  if (invites.size > 100 || memberships.size > 100)
    fail(
      "Workspace access needs pagination before more than 100 records can be shown.",
      503,
    );
  return {
    invites: invites.docs
      .map(inviteProjection)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    memberships: memberships.docs
      .map(membershipProjection)
      .sort((a, b) => a.email.localeCompare(b.email)),
  };
}
async function operation<T>(
  id: string,
  fingerprint: string,
  staff: Staff,
  apply: (tx: FirebaseFirestore.Transaction, now: string) => Promise<T>,
): Promise<T> {
  const ref = collection("workspaceOperations").doc(id);
  return adminServices().db.runTransaction(async (tx) => {
    const prior = await tx.get(ref);
    if (prior.exists) {
      if (prior.data()!.fingerprint !== fingerprint)
        fail(
          "This operation ID was already used for another workspace action.",
        );
      return prior.data()!.result as T;
    }
    const now = new Date().toISOString(),
      result = await apply(tx, now);
    tx.create(ref, {
      businessId,
      fingerprint,
      result,
      actorId: staff.uid,
      createdAt: now,
    });
    return result;
  });
}
export async function saveStaffInvite(
  body: Record<string, unknown>,
  staff: Staff,
) {
  bodyKeys(body, ["input", "operationId"]);
  const input = parsed(staffInviteInputSchema, body.input),
    op = operationId(body);
  return operation(op, JSON.stringify(input), staff, async (tx, now) => {
    const ref = collection("staffInvites").doc(emailId(input.email));
    const [previous, members] = await Promise.all([
      tx.get(ref),
      collection("memberships")
        .where("email", "==", input.email)
        .limit(1)
        .get(),
    ]);
    if (members.size)
      fail(
        "This email already has a staff membership. Manage that membership instead.",
      );
    if (previous.exists && previous.data()!.status === "claimed")
      fail("This invitation has already been claimed and cannot be replaced.");
    if (previous.exists && previous.data()!.status === "pending")
      fail(
        "A pending invitation already exists for this email. Use resend or revoke it.",
      );
    tx.set(ref, {
      ...input,
      businessId,
      status: "pending",
      revision: (previous.data()?.revision ?? 0) + 1,
      createdAt: previous.data()?.createdAt ?? now,
      updatedAt: now,
      claimedBy: null,
      createdBy: staff.uid,
    });
    tx.create(collection("workspaceAudit").doc(op), {
      businessId,
      kind: "invite_created",
      recordId: ref.id,
      before: previous.data() ?? null,
      after: input,
      actorId: staff.uid,
      createdAt: now,
    });
    return { id: ref.id };
  });
}
export async function actOnInvite(body: Record<string, unknown>, staff: Staff) {
  bodyKeys(body, ["input", "operationId"]);
  const input = parsed(staffInviteActionSchema, body.input),
    op = operationId(body);
  return operation(op, JSON.stringify(input), staff, async (tx, now) => {
    const ref = collection("staffInvites").doc(emailId(input.email)),
      previous = await tx.get(ref);
    if (!previous.exists) fail("Invitation not found.", 404);
    const data = previous.data()!;
    if ((data.revision ?? 1) !== input.expectedRevision)
      fail("This invitation changed. Refresh before acting on it.");
    if (data.status !== "pending")
      fail("Only a pending invitation can be changed.");
    const status = input.action === "revoke" ? "revoked" : "pending";
    tx.update(ref, {
      status,
      revision: (data.revision ?? 1) + 1,
      updatedAt: now,
      ...(input.action === "resend" ? { resentAt: now } : {}),
    });
    tx.create(collection("workspaceAudit").doc(op), {
      businessId,
      kind: "invite_" + input.action,
      recordId: ref.id,
      reason: input.reason,
      before: { status: data.status, revision: data.revision ?? 1 },
      after: { status, revision: (data.revision ?? 1) + 1 },
      actorId: staff.uid,
      createdAt: now,
    });
    return { id: ref.id };
  });
}
export async function actOnMembership(
  body: Record<string, unknown>,
  staff: Staff,
) {
  bodyKeys(body, ["input", "operationId"]);
  const input = parsed(staffMembershipActionSchema, body.input),
    op = operationId(body);
  return operation(op, JSON.stringify(input), staff, async (tx, now) => {
    const ref = collection("memberships").doc(input.userId),
      previous = await tx.get(ref);
    if (!previous.exists) fail("Membership not found.", 404);
    const data = previous.data()!;
    if (data.role === "super_admin")
      fail(
        "Super-admin access is managed through deployment/bootstrap procedures.",
        403,
      );
    if ((data.revision ?? 1) !== input.expectedRevision)
      fail("This membership changed. Refresh before acting on it.");
    if (data.status === "active" && input.action === "revoke") {
      const activeAdmins = (
        await collection("memberships")
          .where("role", "==", "super_admin")
          .limit(100)
          .get()
      ).docs.filter((doc) => doc.data().status === "active").length;
      if (!activeAdmins)
        fail("The workspace must retain an active super admin.");
    }
    const status = input.action === "revoke" ? "revoked" : "active",
      revision = (data.revision ?? 1) + 1;
    tx.update(ref, { status, revision, updatedAt: now, updatedBy: staff.uid });
    tx.create(collection("workspaceAudit").doc(op), {
      businessId,
      kind: "membership_" + input.action,
      recordId: ref.id,
      reason: input.reason,
      before: { status: data.status, revision: data.revision ?? 1 },
      after: { status, revision },
      actorId: staff.uid,
      createdAt: now,
    });
    return { id: ref.id, userId: input.userId, status };
  }).then(async (result) => {
    if (input.action === "revoke")
      await adminServices().auth.revokeRefreshTokens(input.userId);
    return result;
  });
}
export { workspaceStaff };
