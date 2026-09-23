import { describe, expect, it } from "vitest";
import { galleryInputSchema, gallerySlug } from "./gallery";
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
