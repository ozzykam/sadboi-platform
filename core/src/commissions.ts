import { z } from "zod";
import { inventoryId } from "./inventory";
const text = (max: number) => z.string().trim().max(max);
const date = z.union([z.literal(""), z.iso.date()]);
export const inquiryStages = ["new", "reviewing", "estimating", "accepted", "declined"] as const;
export const projectStatuses = ["planned", "active", "on_hold", "completed", "cancelled"] as const;
const briefFields = { title: text(180).min(3), brief: text(4000).min(3), deliverables: text(3000).min(3),
  budgetMinor: z.number().int().min(0).max(100_000_000).nullable(), deadline: date, notes: text(4000), archived: z.boolean() };
export const commissionInquirySchema = z.object({ ...briefFields, contactId: inventoryId, stage: z.enum(inquiryStages),
  qualification: text(2000), nextFollowUp: date }).strict();
const milestoneSchema = z.object({ id: z.uuid(), title: text(180).min(1), dueDate: date,
  status: z.enum(["planned", "in_progress", "completed", "skipped"]), notes: text(1000) }).strict();
const taskSchema = z.object({ id: z.uuid(), title: text(180).min(1), dueDate: date, milestoneId: z.union([z.literal(""), z.uuid()]),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]), notes: text(1000) }).strict();
export const commissionProjectSchema = z.object({ ...briefFields, status: z.enum(projectStatuses),
  milestones: z.array(milestoneSchema).max(20), tasks: z.array(taskSchema).max(40) }).strict().superRefine((input, ctx) => {
  const ids = [...input.milestones, ...input.tasks].map(row => row.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Each task and milestone needs its own ID." });
  for (const task of input.tasks) if (task.milestoneId && !input.milestones.some(row => row.id === task.milestoneId))
    ctx.addIssue({ code: "custom", message: "Choose a milestone belonging to this project." });
  const openTask = (task: z.infer<typeof taskSchema>) => !["done", "cancelled"].includes(task.status);
  if (input.milestones.some(row => row.status === "completed" && input.tasks.some(task => task.milestoneId === row.id && openTask(task))))
    ctx.addIssue({ code: "custom", message: "Finish or cancel a milestone's tasks before completing it." });
  if (input.status === "completed" && (input.tasks.some(openTask) || input.milestones.some(row => !["completed", "skipped"].includes(row.status))))
    ctx.addIssue({ code: "custom", message: "Finish or cancel tasks and complete or skip milestones before completing the project." });
});
export type CommissionInquiry = z.infer<typeof commissionInquirySchema>;
export type CommissionProject = z.infer<typeof commissionProjectSchema>;
export const commissionKindSchema = z.enum(["inquiry", "project"]);
const commandFields = { operationId: z.uuid(), expectedRevision: z.number().int().min(0).max(199), note: text(2000).min(3) };
export const commissionCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...commandFields, action: z.literal("inquiry"), id: inventoryId.nullable(), input: commissionInquirySchema }).strict(),
  z.object({ ...commandFields, action: z.literal("convert"), id: inventoryId }).strict(),
  z.object({ ...commandFields, action: z.literal("project"), id: inventoryId, input: commissionProjectSchema }).strict(),
]);
export type CommissionCommand = z.infer<typeof commissionCommandSchema>;
export function initialCommissionProject(input: CommissionInquiry): CommissionProject {
  return { title: input.title, brief: input.brief, deliverables: input.deliverables, budgetMinor: input.budgetMinor,
    deadline: input.deadline, notes: input.notes, archived: false, status: "planned", milestones: [], tasks: [] };
}
export function assertCommissionProjectUpdate(previous: CommissionProject, next: CommissionProject) {
  for (const kind of ["tasks", "milestones"] as const) if (previous[kind].some(row => !next[kind].some(item => item.id === row.id)))
    throw new Error("Saved tasks and milestones stay in history. Cancel tasks or skip milestones instead of removing them.");
  if (previous.archived && next.archived) throw new Error("Restore this project before editing it.");
  if (["completed", "cancelled"].includes(previous.status) && ["completed", "cancelled"].includes(next.status) &&
      JSON.stringify({ ...previous, archived: false }) !== JSON.stringify({ ...next, archived: false }))
    throw new Error("Reopen the project as Active, Planned or On hold before changing closed work.");
}
export function parseCommissionBudget(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error("Enter a USD budget with at most two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 100_000_000) throw new Error("The budget must be no more than $1,000,000.");
  return cents;
}
