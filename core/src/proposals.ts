import { z } from "zod";
import { inventoryId } from "./inventory";
const text = (max: number) => z.string().trim().max(max);
const money = z.number().int().min(0).max(100_000_000);
export const proposalInputSchema = z.object({
  title: text(180).min(3), scope: text(4000).min(3), deliverables: text(3000).min(3),
  timeline: text(2000).min(3), revisionPolicy: text(2000).min(3), terms: text(4000),
  validUntil: z.iso.date(), currency: z.literal("USD"),
  lines: z.array(z.object({ description: text(300).min(1), quantity: z.number().int().min(1).max(1000), unitMinor: money }).strict()).min(1).max(20),
  discountMinor: money, taxMinor: money, taxStatus: z.enum(["not_calculated", "not_applicable", "calculated"]), taxNote: text(1000).min(3),
}).strict().superRefine((input, ctx) => {
  const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitMinor, 0);
  if (subtotal > 100_000_000 || input.discountMinor > subtotal || subtotal - input.discountMinor + input.taxMinor > 100_000_000)
    ctx.addIssue({ code: "custom", message: "Discount cannot exceed the subtotal; subtotal and total cannot exceed $1,000,000." });
  if (input.taxStatus !== "calculated" && input.taxMinor !== 0) ctx.addIssue({ code: "custom", message: "Choose Calculated before adding tax." });
});
export type ProposalInput = z.infer<typeof proposalInputSchema>;
export const proposalStates = ["draft", "issued", "accepted", "declined", "withdrawn"] as const;
export type ProposalState = typeof proposalStates[number];
export const proposalSourceSchema = z.object({ kind: z.enum(["inquiry", "project"]), id: inventoryId }).strict();
const fields = { source: proposalSourceSchema, operationId: z.uuid(), expectedRevision: z.number().int().min(0).max(99), note: text(2000).min(3) };
export const proposalCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...fields, action: z.literal("save"), input: proposalInputSchema }).strict(),
  z.object({ ...fields, action: z.enum(["issue", "revise", "withdraw"]) }).strict(),
  z.object({ ...fields, action: z.enum(["accept", "decline"]), responseReference: text(2000).min(3) }).strict(),
]);
export type ProposalCommand = z.infer<typeof proposalCommandSchema>;
export function proposalTotals(input: ProposalInput) {
  const subtotalMinor = input.lines.reduce((sum, line) => sum + line.quantity * line.unitMinor, 0);
  return { subtotalMinor, totalMinor: subtotalMinor - input.discountMinor + input.taxMinor };
}
export function proposalTransition(state: ProposalState | null, action: ProposalCommand["action"], input: ProposalInput, today: string): ProposalState {
  if (action === "save" && (state === null || state === "draft")) return "draft";
  if (action === "revise" && state && ["issued", "declined", "withdrawn"].includes(state)) return "draft";
  if (action === "issue" && state === "draft") {
    if (input.validUntil < today) throw new Error("Set a current or future validity date before issuing.");
    if (input.taxStatus === "not_calculated") throw new Error("Resolve the tax treatment before issuing.");
    if (proposalTotals(input).totalMinor <= 0) throw new Error("An issued proposal must have a positive total.");
    return "issued";
  }
  if (state === "issued") {
    if (action === "withdraw") return "withdrawn";
    if (action === "decline") return "declined";
    if (action === "accept") {
      if (input.validUntil < today) throw new Error("This proposal expired. Create and issue a revised proposal before recording acceptance.");
      return "accepted";
    }
  }
  throw new Error("This action is unavailable for the saved proposal. Reload its current status.");
}
