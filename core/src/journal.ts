import { z } from "zod";
import { inventoryId, type InventoryRecord } from "./inventory";
const text = (max: number) => z.string().trim().max(max);
export const journalLineSchema = z.object({ account: text(120).min(1), debitMinor: z.number().int().min(0).max(100_000_000_000), creditMinor: z.number().int().min(0).max(100_000_000_000) }).strict().refine(line => (line.debitMinor > 0) !== (line.creditMinor > 0), { message: "Each journal line must have either a debit or credit." });
export const journalEntryInputSchema = z.object({ sourceType: z.enum(["vendor_bill", "payment", "adjustment"]), sourceId: inventoryId, entryDate: z.iso.date(), memo: text(2000).min(1), lines: z.array(journalLineSchema).min(2).max(30) }).strict().superRefine((entry, context) => { const debit = entry.lines.reduce((sum, line) => sum + line.debitMinor, 0), credit = entry.lines.reduce((sum, line) => sum + line.creditMinor, 0); if (debit !== credit) context.addIssue({ code: "custom", message: "Journal debits and credits must balance.", path: ["lines"] }); });
export type JournalEntryInput = z.infer<typeof journalEntryInputSchema>;
export type JournalEntryRecord = InventoryRecord<JournalEntryInput> & { totalMinor: number };
export type JournalCatalog = { entries: JournalEntryRecord[] };
