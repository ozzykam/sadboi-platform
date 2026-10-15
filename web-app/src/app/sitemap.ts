import type { MetadataRoute } from "next";
import { seoSitemapUrls } from "@sadboi/core";
import { publicSeo } from "@/server/seo";
import { publicGallery } from "@/server/gallery";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { input, indexable } = await publicSeo();
  if (!indexable) return [];
  const works = await publicGallery();
  return seoSitemapUrls(
    input.siteUrl,
    works.map((work) => work.slug),
  ).map((url) => ({ url }));
}
