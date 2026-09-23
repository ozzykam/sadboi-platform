import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
export const contactRelationshipKinds = ["client", "collector", "gallery", "licensee", "printer", "supplier", "collaborator", "patron", "other"] as const;
export const contactInputSchema = z.object({
  kind: z.enum(["person", "organization"]), name: text(200).min(1),
  email: z.union([z.literal(""), z.email().max(254)]), phone: text(80), website: text(500),
  organizationId: z.union([z.literal(""), z.string().regex(/^[a-f0-9]{64}$/)]),
  relationships: z.array(z.object({ kind: z.enum(contactRelationshipKinds), label: text(120) }).strict()).max(20),
  notes: text(3000), nextFollowUp: z.union([z.literal(""), z.iso.date()]), followUpNote: text(1000), status: z.enum(["active", "archived"]),
}).strict().superRefine((value, ctx) => {
  if (value.kind === "organization" && value.organizationId) ctx.addIssue({ code: "custom", path: ["organizationId"], message: "Organizations cannot belong to another organization." });
  const keys = value.relationships.map(item => item.kind + ":" + item.label.toLowerCase());
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: "custom", path: ["relationships"], message: "Use each relationship once." });
});
export type ContactInput = z.infer<typeof contactInputSchema>;
export type ContactRecord = ContactInput & { id: string; revision: number; createdAt: string; updatedAt: string };
export type ContactsDirectory = { contacts: ContactRecord[] };
