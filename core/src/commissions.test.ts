import { expect, it } from "vitest";
import { commissionInquirySchema, commissionProjectSchema, initialCommissionProject, assertCommissionProjectUpdate, parseCommissionBudget } from "./commissions";
const inquiry = { contactId: "a".repeat(64), title: "Album artwork", brief: "Create a cover", deliverables: "One cover image", budgetMinor: 50000, deadline: "", notes: "", archived: false, stage: "accepted" as const, qualification: "", nextFollowUp: "" };
const task = { id: "123e4567-e89b-42d3-a456-426614174000", title: "Sketch", status: "todo" as const, dueDate: "", milestoneId: "", notes: "" };
it("validates briefs and exact optional budgets without turning unknown budgets into zero", () => {
  expect(commissionInquirySchema.safeParse(inquiry).success).toBe(true);
  for (const input of [{ ...inquiry, deadline: "2026-02-30" }, { ...inquiry, budgetMinor: 1.5 }, { ...inquiry, clientApproved: true }]) expect(commissionInquirySchema.safeParse(input).success).toBe(false);
  expect(parseCommissionBudget("")).toBe(null); expect(parseCommissionBudget("0")).toBe(0); expect(parseCommissionBudget("123.45")).toBe(12345);
  for (const amount of ["1.001", "-1", "NaN", "1000001", "1e3"]) expect(() => parseCommissionBudget(amount)).toThrow();
});
it("copies the brief into internal planning without inventing acceptance, tasks or charges", () => {
  const project = initialCommissionProject(inquiry);
  expect(project).toMatchObject({ status: "planned", budgetMinor: 50000, tasks: [], milestones: [] });
  expect(project).not.toHaveProperty("contactId"); expect(project).not.toHaveProperty("stage");
});
it("prevents completion with unfinished work and invalid or duplicate milestone links", () => {
  const project = { ...initialCommissionProject(inquiry), tasks: [task] };
  expect(commissionProjectSchema.safeParse({ ...project, status: "completed" }).success).toBe(false);
  expect(commissionProjectSchema.safeParse({ ...project, tasks: [{ ...task, milestoneId: task.id }] }).success).toBe(false);
  expect(commissionProjectSchema.safeParse({ ...project, tasks: [task, task] }).success).toBe(false);
  expect(commissionProjectSchema.safeParse({ ...project, status: "completed", tasks: [{ ...task, status: "done" }] }).success).toBe(true);
});
it("preserves saved work rows and requires explicit reopening of closed projects", () => {
  const project = { ...initialCommissionProject(inquiry), tasks: [task] };
  expect(() => assertCommissionProjectUpdate(project, { ...project, tasks: [] })).toThrow();
  const cancelled = { ...project, status: "cancelled" as const };
  expect(() => assertCommissionProjectUpdate(cancelled, { ...cancelled, title: "Changed title" })).toThrow();
  expect(() => assertCommissionProjectUpdate(cancelled, { ...cancelled, archived: true })).not.toThrow();
  expect(() => assertCommissionProjectUpdate(cancelled, { ...cancelled, status: "active" })).not.toThrow();
});
