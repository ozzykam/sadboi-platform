import { z } from "zod";
import { inventoryId } from "./inventory";
import { storePaymentOrderId } from "./store-payments";

export const disputeStatuses = ["warning_needs_response", "warning_under_review", "warning_closed", "needs_response", "under_review", "won", "lost", "prevented"] as const;
export const disputeSnapshotSchema = z.object({
  id: z.string().regex(/^du_[a-zA-Z0-9]+$/), paymentId: z.string().regex(/^pi_[a-zA-Z0-9]+$/), chargeId: z.string().regex(/^ch_[a-zA-Z0-9]+$/),
  amountMinor: z.number().int().positive().max(100_000_000_000), currency: z.literal("USD"),
  status: z.enum(disputeStatuses), reason: z.string().min(1).max(160), createdAt: z.iso.datetime(),
  dueAt: z.iso.datetime().nullable(), hasEvidence: z.boolean(), pastDue: z.boolean(),
  submissionCount: z.number().int().nonnegative(), isChargeRefundable: z.boolean(),
}).strict();
export type DisputeSnapshot = z.infer<typeof disputeSnapshotSchema>;
export function disputeNeedsSync(status: DisputeSnapshot["status"]) {
  return ["needs_response", "under_review", "warning_needs_response", "warning_under_review"].includes(status);
}
export function disputeBlocksDispatch(status: DisputeSnapshot["status"]) {
  return disputeNeedsSync(status) || status === "lost";
}
const disputeStateSchema = z.object({ revision: z.number().int().nonnegative(), checkedAt: z.iso.datetime().nullable(), rows: z.array(disputeSnapshotSchema).max(20) }).strict();
export function readDisputeState(raw: unknown) {
  if (raw === undefined) return { revision: 0, checkedAt: null, rows: [] as DisputeSnapshot[] };
  const state = disputeStateSchema.parse(raw);
  if (new Set(state.rows.map(row => row.id)).size !== state.rows.length) throw new Error("Duplicate dispute history needs review.");
  return state;
}
export function orderHasDisputeHold(raw: unknown) { return readDisputeState(raw).rows.some(row => disputeBlocksDispatch(row.status)); }
export const disputeNoteInputSchema = z.object({
  plan: z.enum(["undecided", "challenge", "accept"]), evidence: z.string().trim().max(4000), note: z.string().trim().min(3).max(2000),
}).strict();
export type DisputeNoteInput = z.infer<typeof disputeNoteInputSchema>;
export const disputeNoteRequestSchema = z.object({ orderId: storePaymentOrderId, id: inventoryId, operationId: z.uuid(),
  expectedRevision: z.number().int().min(0).max(200), input: disputeNoteInputSchema }).strict();
export type DisputeNoteRequest = z.infer<typeof disputeNoteRequestSchema>;
export const disputeCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("refresh"), orderId: storePaymentOrderId }).strict(),
  disputeNoteRequestSchema.extend({ action: z.literal("note") }),
]);
