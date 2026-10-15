import type { MetadataRoute } from "next";
import { publicSeo } from "@/server/seo";
export const dynamic = "force-dynamic";
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { input, indexable } = await publicSeo();
  // Crawlers must be able to read noindex tags. Blocking HTML here can hide them.
  return {
    rules: { userAgent: "*", allow: "/" },
    ...(indexable ? { sitemap: `${input.siteUrl}/sitemap.xml` } : {}),
  };
}
