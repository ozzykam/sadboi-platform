import { expect, it } from "vitest";
import { proofInputSchema } from "./proofs";
const id = "a".repeat(64);
const proof = { orderId: id, variantId: "b".repeat(64), assetId: "c".repeat(64), version: 1, status: "sent", notes: "Please confirm trim and color." };
it("validates proof versions and statuses", () => {
  expect(proofInputSchema.safeParse(proof).success).toBe(true);
  expect(proofInputSchema.safeParse({ ...proof, version: 0 }).success).toBe(false);
  expect(proofInputSchema.safeParse({ ...proof, status: "accepted" }).success).toBe(false);
});
