import { expect, it } from "vitest";
import { periodLockInputSchema, reconciliationInputSchema } from "./financial-controls";
it("validates periods and reconciliation balances", () => { expect(periodLockInputSchema.safeParse({ period: "2026-09", reason: "Month close" }).success).toBe(true); expect(periodLockInputSchema.safeParse({ period: "2026-13", reason: "Month close" }).success).toBe(false); expect(reconciliationInputSchema.safeParse({ account: "Bank", statementDate: "2026-09-30", openingMinor: 100, closingMinor: 200, status: "reconciled", notes: "Checked" }).success).toBe(true); });
