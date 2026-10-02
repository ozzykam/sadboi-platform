import { describe, it, expect } from "vitest";
import { proposalInputSchema, proposalTotals, proposalTransition, type ProposalInput } from "./proposals";
const input: ProposalInput = { title: "Cover art", scope: "Original illustration", deliverables: "One final image", timeline: "Two weeks after agreement", revisionPolicy: "Two rounds of revisions", terms: "", validUntil: "2026-12-31", currency: "USD", lines: [{ description: "Artwork", quantity: 3, unitMinor: 19999 }], discountMinor: 999, taxMinor: 4720, taxStatus: "calculated", taxNote: "Manually confirmed tax" };
describe("proposals", () => {
  it("uses exact cents and rejects invalid totals, quantities and hidden fields", () => {
    expect(proposalTotals(input)).toEqual({ subtotalMinor: 59997, totalMinor: 63718 });
    for (const quantity of [0, 1.5, 1001]) expect(proposalInputSchema.safeParse({ ...input, lines: [{ ...input.lines[0], quantity }] }).success).toBe(false);
    for (const invalid of [{ ...input, discountMinor: 60000 }, { ...input, taxMinor: 0.1 }, { ...input, taxStatus: "not_applicable" }, { ...input, paid: true }, { ...input, validUntil: "2026-02-30" }, { ...input, lines: [{ description: "Large", quantity: 1000, unitMinor: 100_000_000 }] }]) expect(proposalInputSchema.safeParse(invalid).success).toBe(false);
  });
  it("freezes issued and accepted pricing and allows a separate revised draft", () => {
    expect(proposalTransition("issued", "revise", input, "2026-10-01")).toBe("draft");
    for (const state of ["issued", "accepted", "declined", "withdrawn"] as const) expect(() => proposalTransition(state, "save", input, "2026-10-01")).toThrow();
    for (const action of ["revise", "withdraw", "accept", "issue"] as const) expect(() => proposalTransition("accepted", action, input, "2026-10-01")).toThrow();
  });
  it("requires resolved tax, positive total and an unexpired issue/acceptance", () => {
    expect(proposalTransition("draft", "issue", input, "2026-12-31")).toBe("issued");
    expect(proposalTransition("issued", "accept", input, "2026-12-31")).toBe("accepted");
    expect(() => proposalTransition("draft", "issue", { ...input, taxStatus: "not_calculated", taxMinor: 0 }, "2026-10-01")).toThrow();
    expect(() => proposalTransition("draft", "issue", { ...input, discountMinor: 59997, taxMinor: 0 }, "2026-10-01")).toThrow();
    for (const [state, action] of [["draft", "issue"], ["issued", "accept"]] as const) expect(() => proposalTransition(state, action, input, "2027-01-01")).toThrow();
    expect(proposalTransition("issued", "decline", input, "2027-01-01")).toBe("declined");
  });
});
