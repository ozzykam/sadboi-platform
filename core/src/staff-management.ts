import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);
export const staffInviteInputSchema = z.object({
  email, role: z.enum(["legal", "accounting"]), note: z.string().trim().max(1000),
}).strict();
export const staffMembershipActionSchema = z.object({
  userId: z.string().trim().min(1).max(200), expectedRevision: z.number().int().positive(), action: z.enum(["revoke", "reactivate"]), reason: z.string().trim().min(3).max(1000),
}).strict();
export const staffInviteActionSchema = z.object({
  email, expectedRevision: z.number().int().positive(), action: z.enum(["revoke", "resend"]), reason: z.string().trim().min(3).max(1000),
}).strict();
export type StaffInviteInput = z.infer<typeof staffInviteInputSchema>;
export type StaffInviteRecord = StaffInviteInput & { id: string; status: "pending" | "claimed" | "revoked"; revision: number; createdAt: string; updatedAt: string; claimedBy: string | null };
export type StaffMembershipRecord = { userId: string; email: string; role: "super_admin" | "legal" | "accounting"; status: "active" | "revoked"; revision: number; createdAt: string; updatedAt: string };
export type StaffDirectory = { invites: StaffInviteRecord[]; memberships: StaffMembershipRecord[] };
