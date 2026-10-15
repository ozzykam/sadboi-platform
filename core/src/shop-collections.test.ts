import { describe, it, expect } from "vitest";
import {
  shopCollectionInputSchema,
  shopCollectionCommandSchema,
} from "./shop-collections";
import { seoSitemapUrls } from "./seo";
const input = {
  title: "Night creatures",
  description: "A themed release",
  productIds: ["a".repeat(64)],
  artworkIds: [],
  order: 0,
};
describe("shop collections", () => {
  it("allows empty drafts but rejects duplicate, malformed and oversized member lists", () => {
    expect(
      shopCollectionInputSchema.safeParse({ ...input, productIds: [] }).success,
    ).toBe(true);
    for (const productIds of [
      [...input.productIds, ...input.productIds],
      ["../private"],
      Array.from({ length: 101 }, (_, i) => i.toString(16).padStart(64, "0")),
    ])
      expect(
        shopCollectionInputSchema.safeParse({ ...input, productIds }).success,
      ).toBe(false);
  });
  it("separates draft saves from explicit publication and requires saved versions", () => {
    const operationId = "e8942924-a2e2-45b9-9658-cfa2c9714ab5";
    expect(
      shopCollectionCommandSchema.safeParse({
        action: "save",
        id: null,
        revision: 0,
        operationId,
        input,
      }).success,
    ).toBe(true);
    expect(
      shopCollectionCommandSchema.safeParse({
        action: "publish",
        id: input.productIds[0],
        revision: 1,
        operationId,
        input,
      }).success,
    ).toBe(false);
    expect(
      shopCollectionCommandSchema.safeParse({
        action: "publish",
        id: input.productIds[0],
        revision: 0,
        operationId,
      }).success,
    ).toBe(false);
    expect(
      shopCollectionInputSchema.safeParse({ ...input, published: true })
        .success,
    ).toBe(false);
  });
  it("includes unique collection addresses alongside product and artwork links", () => {
    const urls = seoSitemapUrls(
      "https://sadboi.art",
      ["work"],
      ["product"],
      ["collection", "collection"],
    );
    expect(urls).toHaveLength(8);
    expect(urls).toContain("https://sadboi.art/shop/collections/collection");
  });
});
