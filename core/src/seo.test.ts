import { describe, expect, it } from "vitest";
import {
  defaultSeoInput,
  seoInputSchema,
  seoSaveSchema,
  seoIndexingAllowed,
  seoSitemapUrls,
  seoJsonLd,
  seoWebsiteData,
} from "./seo";

describe("website SEO", () => {
  it("adds the supplied profiles to older settings and supports explicitly removing them", () => {
    const legacy = {
      ...defaultSeoInput,
      instagramUrl: undefined,
      xUrl: undefined,
    };
    const migrated = seoInputSchema.parse(legacy);
    expect(migrated.instagramUrl).toBe(
      "https://www.instagram.com/sadboi_illustration/",
    );
    expect(migrated.xUrl).toBe("https://x.com/Sadboi0808");
    expect(seoWebsiteData(migrated)?.creator.sameAs).toEqual([
      migrated.instagramUrl,
      migrated.xUrl,
    ]);
    const cleared = seoInputSchema.parse({
      ...migrated,
      instagramUrl: "",
      xUrl: "",
    });
    expect(seoWebsiteData(cleared)?.creator.sameAs).toEqual([]);
  });
  it("accepts profile URLs while rejecting scripts, misleading hosts and unrelated pages", () => {
    for (const instagramUrl of [
      "javascript:alert(1)",
      "https://instagram.com.evil.example/artist",
      "https://www.instagram.com/p/post-id/",
      "http://instagram.com/artist",
      "https://user@instagram.com/artist",
    ]) {
      expect(
        seoInputSchema.safeParse({ ...defaultSeoInput, instagramUrl }).success,
      ).toBe(false);
    }
    for (const xUrl of [
      "https://x.com.evil.example/Sadboi0808",
      "https://x.com/Sadboi0808/status/1",
      "javascript:alert(1)",
    ]) {
      expect(
        seoInputSchema.safeParse({ ...defaultSeoInput, xUrl }).success,
      ).toBe(false);
    }
    expect(
      seoInputSchema.parse({
        ...defaultSeoInput,
        xUrl: " https://x.com/Sadboi0808/ ",
      }).xUrl,
    ).toBe("https://x.com/Sadboi0808/");
  });
  const input = {
    ...defaultSeoInput,
    siteUrl: "https://studio.example.com",
    indexingEnabled: true,
  };
  const production = {
    nodeEnv: "production",
    vercelEnv: "production",
    host: "studio.example.com",
    mode: "staff",
  };
  it("requires an explicit public canonical origin before publishing", () => {
    expect(seoInputSchema.parse(defaultSeoInput).indexingEnabled).toBe(false);
    expect(
      seoInputSchema.safeParse({
        ...defaultSeoInput,
        siteUrl: "",
        indexingEnabled: true,
      }).success,
    ).toBe(false);
    expect(
      seoInputSchema.parse({ ...input, siteUrl: "https://STUDIO.example.com/" })
        .siteUrl,
    ).toBe(input.siteUrl);
    for (const siteUrl of [
      "http://studio.example.com",
      "https://localhost",
      "https://127.0.0.1",
      "https://studio.local",
      "https://user:pass@example.com",
      "https://example.com/shop",
      "https://example.com?x=1",
      "https://example.com#x",
      "https://example.com:3100",
    ]) {
      expect(seoInputSchema.safeParse({ ...input, siteUrl }).success).toBe(
        false,
      );
    }
  });
  it("keeps development, previews, aliases, and unpublished settings noindex", () => {
    expect(seoIndexingAllowed(input, production)).toBe(true);
    for (const override of [
      { nodeEnv: "development" },
      { vercelEnv: "preview" },
      { host: "other.example.com" },
      { host: "studio.example.com:3100" },
      { mode: "preview" },
      { mode: "locked" },
    ])
      expect(seoIndexingAllowed(input, { ...production, ...override })).toBe(
        false,
      );
    expect(seoIndexingAllowed(defaultSeoInput, production)).toBe(false);
    expect(
      seoIndexingAllowed({ ...input, indexingEnabled: false }, production),
    ).toBe(false);
  });
  it("validates bounded fields and forbids arbitrary tags or extra settings", () => {
    expect(
      seoInputSchema.safeParse({
        ...input,
        googleVerification: '<meta content="test">',
      }).success,
    ).toBe(false);
    expect(seoInputSchema.safeParse({ ...input, homeTitle: "" }).success).toBe(
      false,
    );
    expect(
      seoInputSchema.safeParse({ ...input, robots: "index" }).success,
    ).toBe(false);
    expect(
      seoSaveSchema.safeParse({
        input,
        expectedRevision: -1,
        operationId: "invalid",
      }).success,
    ).toBe(false);
  });
  it("maps only public paths and published artwork slugs into the sitemap", () => {
    const urls = seoSitemapUrls(input.siteUrl, [
      "piece-a",
      "piece-a",
      "piece-b",
    ]);
    expect(urls).toHaveLength(7);
    expect(urls).toContain(input.siteUrl + "/art/piece-a");
    expect(
      urls.some((url) => /admin|orders|agreement|sign-in|checkout/.test(url)),
    ).toBe(false);
  });
  it("escapes script boundaries and omits structured data without a domain", () => {
    expect(seoWebsiteData({ ...defaultSeoInput, siteUrl: "" })).toBeNull();
    const text = seoJsonLd(
      seoWebsiteData({
        ...input,
        homeDescription: "</script><script>alert(1)</script>",
      }),
    );
    expect(text).not.toContain("<");
    expect(JSON.parse(text).url).toBe(input.siteUrl + "/");
    expect(JSON.parse(text).description).toContain("</script>");
  });
  it("includes each public product URL once without changing artwork URLs", () => {
    const urls = seoSitemapUrls(
      input.siteUrl,
      ["piece-a"],
      ["a".repeat(64), "a".repeat(64), "b".repeat(64)],
    );
    expect(urls).toHaveLength(8);
    expect(urls).toContain(input.siteUrl + "/shop/" + "a".repeat(64));
    expect(urls).toContain(input.siteUrl + "/art/piece-a");
  });
});
