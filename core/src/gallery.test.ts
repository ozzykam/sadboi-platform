import { describe, expect, it } from "vitest";
import { galleryInputSchema, galleryOrderSchema, gallerySlug } from "./gallery";
const input = {
  published: true,
  assetId: "a".repeat(64),
  alt: "A skull surrounded by gold flowers.",
  caption: "",
  credits: "",
  order: 0,
  rightsConfirmed: true,
};
describe("gallery publication", () => {
  it("validates bounded order batches and rejects duplicate IDs or injected fields", () => {
    const entry = { id: "a".repeat(64), revision: 1, order: 0 };
    expect(galleryOrderSchema.safeParse([entry]).success).toBe(true);
    for (const entries of [
      [],
      [entry, entry],
      [{ ...entry, order: -1 }],
      [{ ...entry, order: 1.5 }],
      [{ ...entry, order: 1000000 }],
      [{ ...entry, revision: 0 }],
      [{ ...entry, id: "../private" }],
      [{ ...entry, published: true }],
      Array.from({ length: 101 }, (_, index) => ({
        ...entry,
        id: index.toString(16).padStart(64, "0"),
      })),
    ]) {
      expect(galleryOrderSchema.safeParse(entries).success).toBe(false);
    }
  });
  it("requires a selected image, visual description, and publication permission", () => {
    expect(galleryInputSchema.safeParse(input).success).toBe(true);
    for (const change of [
      { assetId: null },
      { alt: " " },
      { rightsConfirmed: false },
    ])
      expect(
        galleryInputSchema.safeParse({ ...input, ...change }).success,
      ).toBe(false);
  });
  it("can withdraw a work without publication prerequisites", () => {
    expect(
      galleryInputSchema.safeParse({
        ...input,
        published: false,
        assetId: null,
        alt: "",
        rightsConfirmed: false,
      }).success,
    ).toBe(true);
  });
  it("rejects client supplied paths, invalid asset IDs, and invalid ordering", () => {
    for (const change of [
      { originalPath: "/private" },
      { assetId: "../master" },
      { order: -1 },
      { order: 1.5 },
    ])
      expect(
        galleryInputSchema.safeParse({ ...input, ...change }).success,
      ).toBe(false);
  });
  it("generates deterministic routes with a safe title and complete unique record ID", () => {
    expect(gallerySlug("Étude / 夜", "a".repeat(64))).toBe(
      "etude-" + "a".repeat(64),
    );
    expect(gallerySlug("夜", "b".repeat(64))).toBe("artwork-" + "b".repeat(64));
  });
});
