import { expect, it } from "vitest";
import { journalEntryInputSchema } from "./journal";
const input = { sourceType: "vendor_bill", sourceId: "a".repeat(64), entryDate: "2026-09-21", memo: "Record supplier invoice", lines: [{ account: "Inventory", debitMinor: 80000, creditMinor: 0 }, { account: "Accounts payable", debitMinor: 0, creditMinor: 80000 }] };
it("requires balanced double-entry journals", () => { expect(journalEntryInputSchema.safeParse(input).success).toBe(true); expect(journalEntryInputSchema.safeParse({ ...input, lines: [{ ...input.lines[0], debitMinor: 1 }, input.lines[1]] }).success).toBe(false); });
