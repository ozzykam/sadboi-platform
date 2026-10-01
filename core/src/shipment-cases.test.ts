import { describe, expect, it } from "vitest";
import { shipmentCaseInputSchema, validateShipmentCase, replacementEffect, type ShipmentCaseInput } from "./shipment-cases";
const variantId = "a".repeat(64), input: ShipmentCaseInput = { kind: "damaged", status: "open", items: [{ variantId, quantity: 1 }], carrier: "", claimReference: "", evidence: "", note: "Damaged print", resolution: null, refundId: null, returnId: null };
describe("shipment case lifecycle", () => {
  it("requires an open first case and dispatched quantities, rejects duplicate affected items", () => {
    expect(() => validateShipmentCase(null, input, [{ variantId, quantity: 2 }])).not.toThrow();
    expect(() => validateShipmentCase(null, { ...input, status: "investigating" }, [{ variantId, quantity: 2 }])).toThrow();
    expect(() => validateShipmentCase(null, input, [{ variantId: "b".repeat(64), quantity: 2 }])).toThrow();
    expect(() => validateShipmentCase(null, { ...input, items: [{ variantId, quantity: 3 }] }, [{ variantId, quantity: 2 }])).toThrow();
    expect(shipmentCaseInputSchema.safeParse({ ...input, items: [...input.items, ...input.items] }).success).toBe(false);
  });
  it("requires a matching resolution and explicit reopen of a closed case", () => {
    const resolved = { ...input, status: "resolved" as const, resolution: "no_refund" as const };
    expect(() => validateShipmentCase(resolved, resolved, [{ variantId, quantity: 2 }])).toThrow();
    expect(() => validateShipmentCase(resolved, { ...input, status: "investigating" }, [{ variantId, quantity: 2 }])).not.toThrow();
    expect(shipmentCaseInputSchema.safeParse({ ...resolved, resolution: "refund" }).success).toBe(false);
    expect(shipmentCaseInputSchema.safeParse({ ...resolved, resolution: "located" }).success).toBe(false);
    expect(shipmentCaseInputSchema.safeParse({ ...resolved, resolution: "refund", refundId: "b".repeat(64) }).success).toBe(true);
  });
  it("consumes replacement stock only on dispatch and permits release only before dispatch", () => {
    expect(replacementEffect("prepared", "shipped")).toBe("consume");
    expect(replacementEffect("prepared", "cancelled")).toBe("release");
    expect(replacementEffect("shipped", "shipped")).toBe("none");
    expect(replacementEffect("shipped", "delivered")).toBe("none");
    for (const pair of [["shipped", "cancelled"], ["prepared", "delivered"], ["delivered", "shipped"], ["cancelled", "prepared"]] as const) expect(() => replacementEffect(pair[0], pair[1])).toThrow();
  });
});
