import type { MetadataRoute } from "next";
import { seoSitemapUrls } from "@sadboi/core";
import { publicSeo } from "@/server/seo";
import { publicGallery } from "@/server/gallery";
import { publicCatalog } from "@/server/public-catalog";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { input, indexable } = await publicSeo();
  if (!indexable) return [];
  const [works, catalog] = await Promise.all([publicGallery(), publicCatalog()]);
  return seoSitemapUrls(
    input.siteUrl,
    works.map((work) => work.slug),
    catalog.products.map((product) => product.id),
  ).map((url) => ({ url }));
}
