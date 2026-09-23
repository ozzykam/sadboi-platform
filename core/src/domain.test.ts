import { describe, expect, it } from "vitest";
import { availableStock, artworkInputSchema, artworkPreview, can, catalogSchema, emptyCatalog, moneySchema, onlineAvailable, parsePreviewCatalog, reserveStock, sampleCatalog, saveArtworkDraft } from "./index";
const input = () => { const { id, businessId, createdAt, updatedAt, ...fields } = sampleCatalog().artworks[0]; return fields; };
describe("catalog integrity", () => {
  it("keeps art separate from products and removes private fields from previews", () => {
    const c = sampleCatalog();
    expect(c.variants.filter(v => v.artworkId === c.artworks[0].id)).toHaveLength(2);
    expect(artworkPreview(c.artworks[0])).not.toHaveProperty("internalNotes");
    expect(artworkPreview(c.artworks[0])).not.toHaveProperty("businessId");
  });
  it("rejects cross-business records and dangling links", () => {
    const c = sampleCatalog(); c.artworks[0].businessId = "other";
    expect(() => catalogSchema.parse(c)).toThrow();
    const d = sampleCatalog(); d.variants[0].artworkId = "missing";
    expect(() => catalogSchema.parse(d)).toThrow();
  });
  it("rejects duplicate SKUs and stock balances", () => {
    const c = sampleCatalog(); c.variants[1].sku = c.variants[0].sku.toLowerCase();
    expect(() => catalogSchema.parse(c)).toThrow();
    const d = sampleCatalog(); d.stock.push(d.stock[0]);
    expect(() => catalogSchema.parse(d)).toThrow();
  });
  it("rejects incomplete dimensions and injected metadata", () => {
    expect(artworkInputSchema.safeParse({ ...input(), pixelHeight: null }).success).toBe(false);
    expect(artworkInputSchema.safeParse({ ...input(), businessId: "other" }).success).toBe(false);
  });
  it("edits and archives while preserving identity and creation time", () => {
    const first = saveArtworkDraft(emptyCatalog, input(), "new-art", "2026-09-16T12:00:00.000Z");
    const edit = saveArtworkDraft(first, { ...input(), title: "Revised", status: "archived" }, "new-art", "2026-09-17T12:00:00.000Z");
    expect(edit.artworks).toHaveLength(1); expect(edit.artworks[0].title).toBe("Revised");
    expect(edit.artworks[0].createdAt).toBe(first.artworks[0].createdAt);
    expect(edit.artworks[0].updatedAt).not.toBe(first.artworks[0].updatedAt);
  });
  it("validates preview restores and rejects other workspace exports", () => {
    expect(parsePreviewCatalog(JSON.parse(JSON.stringify(sampleCatalog())))).toEqual(sampleCatalog());
    expect(() => parsePreviewCatalog({ ...emptyCatalog, businessId: "other" })).toThrow();
    expect(() => parsePreviewCatalog({ version: 99 })).toThrow();
  });
});
describe("stock and money", () => {
  it("subtracts all stock commitments", () => { expect(availableStock(sampleCatalog().stock[0])).toBe(14); });
  it("excludes gallery and transit locations from online stock", () => {
    const c = sampleCatalog(); expect(onlineAvailable(c, "print-01")).toBe(14);
    c.locations[1].onlineEligible = true; expect(onlineAvailable(c, "print-01")).toBe(19);
    c.locations[1].kind = "transit"; expect(onlineAvailable(c, "print-01")).toBe(14);
  });
  it("cannot reserve above availability or use nonpositive quantities", () => {
    const s = sampleCatalog().stock[0]; expect(availableStock(reserveStock(s, 14))).toBe(0);
    for (const qty of [15, 0, -1, .5, Infinity]) expect(() => reserveStock(s, qty)).toThrow();
    expect(s.reserved).toBe(2);
  });
  it("rejects impossible balances and unsafe or fractional minor units", () => {
    expect(() => availableStock({ ...sampleCatalog().stock[0], onHand: 1 })).toThrow();
    expect(moneySchema.safeParse({ amountMinor: 45.5, currency: "USD" }).success).toBe(false);
    expect(moneySchema.safeParse({ amountMinor: Number.MAX_SAFE_INTEGER + 1, currency: "USD" }).success).toBe(false);
  });
});
describe("membership policy", () => {
  const owner = { userId: "owner", businessId: "studio", role: "super_admin", status: "active" } as const;
  it("requires an active membership for the correct business", () => {
    expect(can(owner, "studio", "artwork:write")).toBe(true);
    expect(can(owner, "other", "artwork:write")).toBe(false);
    expect(can({ ...owner, status: "revoked" }, "studio", "artwork:write")).toBe(false);
    expect(can(null, "studio", "artwork:write")).toBe(false);
  });
  it("separates legal, accounting, and customer scope", () => {
    expect(can({ ...owner, role: "legal" }, "studio", "agreements:write")).toBe(true);
    expect(can({ ...owner, role: "legal" }, "studio", "finance:read")).toBe(false);
    expect(can({ ...owner, role: "accounting" }, "studio", "artwork:read")).toBe(false);
    expect(can({ ...owner, role: "accounting" }, "studio", "finance:write")).toBe(true);
    for (const role of ["legal", "accounting", "customer"] as const) expect(can({ ...owner, role }, "studio", "members:manage")).toBe(false);
  });
});
