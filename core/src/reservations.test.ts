import { expect, it } from "vitest";
import { reservationInputSchema } from "./reservations";
const input = { variantId: "a".repeat(64), locationId: "b".repeat(64), reference: "COMM-1", purpose: "commission", quantity: 2, status: "reserved", notes: "" };
it("validates reservation purposes and statuses", () => { expect(reservationInputSchema.safeParse(input).success).toBe(true); expect(reservationInputSchema.safeParse({ ...input, quantity: 0 }).success).toBe(false); expect(reservationInputSchema.safeParse({ ...input, purpose: "sale" }).success).toBe(false); });
