import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminServices, authConfig } from "./firebase";
import { getMode } from "./mode";
export type StaffRole = "super_admin" | "legal" | "accounting";
export type Staff = { uid: string; email: string; role: StaffRole };
export class AccessError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const businessId = "sadboi";
export const sessionSeconds = 12 * 60 * 60;
export function cookieName(kind: "session" | "csrf") {
  return (authConfig().secure ? "__Host-" : "") + "sadboi_" + kind;
}
export function cookieOptions() {
  return {
    httpOnly: true,
    secure: authConfig().secure,
    sameSite: "strict" as const,
    path: "/",
  };
}
const roles: readonly string[] = ["super_admin", "legal", "accounting"];
export function validRole(role: unknown): role is StaffRole {
  return typeof role === "string" && roles.includes(role);
}
const emailOf = (token: DecodedIdToken) => token.email?.trim().toLowerCase();
function readMember(
  uid: string,
  email: string,
  data: FirebaseFirestore.DocumentData | undefined,
): Staff | null {
  return data?.userId === uid &&
    data.businessId === businessId &&
    data.email === email &&
    data.status === "active" &&
    validRole(data.role)
    ? { uid, email, role: data.role }
    : null;
}
export async function claimStaff(token: DecodedIdToken): Promise<Staff> {
  const email = emailOf(token);
  if (!email || token.email_verified !== true)
    throw new AccessError(
      403,
      "verify-email",
      "Verify your email address before entering the studio.",
    );
  const { db } = adminServices();
  const member = db.doc(
    "businesses/" + businessId + "/memberships/" + token.uid,
  );
  const invite = db.doc(
    "businesses/" +
      businessId +
      "/staffInvites/" +
      createHash("sha256").update(email).digest("hex"),
  );
  return db.runTransaction(async (tx) => {
    const record = await tx.get(member);
    if (record.exists) {
      const staff = readMember(token.uid, email, record.data());
      if (!staff)
        throw new AccessError(
          403,
          "no-access",
          "This account does not have active staff access.",
        );
      return staff;
    }
    const invitation = (await tx.get(invite)).data();
    if (
      invitation?.email !== email ||
      invitation?.status !== "pending" ||
      !validRole(invitation?.role)
    )
      throw new AccessError(
        403,
        "no-access",
        "This account does not have active staff access.",
      );
    const staff = { uid: token.uid, email, role: invitation.role };
    tx.create(member, {
      userId: token.uid,
      email,
      role: staff.role,
      businessId,
      status: "active",
      revision: 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(invite, {
      status: "claimed",
      claimedBy: token.uid,
      claimedAt: FieldValue.serverTimestamp(),
    });
    return staff;
  });
}
const invalidSessionCodes = new Set([
  "auth/session-cookie-expired",
  "auth/session-cookie-revoked",
  "auth/invalid-session-cookie",
  "auth/argument-error",
  "auth/user-disabled",
  "auth/user-not-found",
]);
export async function staffForCookie(value?: string): Promise<Staff | null> {
  if (!value) return null;
  const { auth, db } = adminServices();
  let token: DecodedIdToken;
  try {
    token = await auth.verifySessionCookie(value, true);
  } catch (error) {
    if (invalidSessionCodes.has((error as { code?: string }).code ?? ""))
      return null;
    throw error;
  }
  const email = emailOf(token);
  if (!email || !token.email_verified) return null;
  return readMember(
    token.uid,
    email,
    (
      await db
        .doc("businesses/" + businessId + "/memberships/" + token.uid)
        .get()
    ).data(),
  );
}
export async function requireStaff(
  allowed?: readonly StaffRole[],
): Promise<Staff> {
  if (getMode() !== "staff") redirect("/sign-in");
  const staff = await staffForCookie(
    (await cookies()).get(cookieName("session"))?.value,
  );
  if (!staff) redirect("/sign-in");
  if (allowed && !allowed.includes(staff.role)) redirect("/admin");
  return staff;
}
export async function limitSessionCreation(uid: string) {
  const { db } = adminServices();
  const ref = db.doc(
    "authRateLimits/" + createHash("sha256").update(uid).digest("hex"),
  );
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data();
    const current = data && now - data.startedAt < 60000;
    const count = current ? data.count : 0;
    if (count >= 10)
      throw new AccessError(
        429,
        "rate-limited",
        "Too many sign-in attempts. Wait a minute and try again.",
      );
    tx.set(ref, {
      startedAt: current ? data.startedAt : now,
      count: count + 1,
    });
  });
}
