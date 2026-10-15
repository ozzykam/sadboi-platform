import { z } from "zod";

export const defaultSeoInput = {
  siteUrl: "https://sadboi.art",
  homeTitle: "Sadboi Studios — Original Artwork by Joel Hedstrom",
  homeDescription:
    "Explore original artwork and editions by Joel Hedstrom at Sadboi Studios. Browse the gallery, shop merchandise, and find upcoming public appearances.",
  indexingEnabled: false,
  googleVerification: "",
  instagramUrl: "https://www.instagram.com/sadboi_illustration/",
  xUrl: "https://x.com/Sadboi0808",
};

const siteUrl = z
  .string()
  .trim()
  .max(253)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.port &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash &&
        /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(
          url.hostname,
        ) &&
        !/\.(?:localhost|local|test|invalid|internal)$/i.test(url.hostname)
      );
    } catch {
      return false;
    }
  }, "Use the public HTTPS site address without a path, query, or port.")
  .transform((value) => (value ? new URL(value).origin : ""));

export const seoInputSchema = z
  .object({
    siteUrl,
    homeTitle: z.string().trim().min(10).max(120),
    homeDescription: z.string().trim().min(40).max(320),
    indexingEnabled: z.boolean(),
    instagramUrl: z
      .string()
      .trim()
      .max(200)
      .regex(
        /^(?:https:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._]+\/?)?$/,
        "Use an HTTPS Instagram profile link, or leave blank to hide it.",
      )
      .default(defaultSeoInput.instagramUrl),
    xUrl: z
      .string()
      .trim()
      .max(200)
      .regex(
        /^(?:https:\/\/(?:www\.)?x\.com\/[A-Za-z0-9_]{1,15}\/?)?$/,
        "Use an HTTPS X profile link, or leave blank to hide it.",
      )
      .default(defaultSeoInput.xUrl),
    googleVerification: z
      .string()
      .trim()
      .max(200)
      .regex(
        /^[a-zA-Z0-9_-]*$/,
        "Paste only the Google verification token, not the HTML tag.",
      ),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.indexingEnabled && !input.siteUrl)
      ctx.addIssue({
        code: "custom",
        path: ["siteUrl"],
        message: "Set the public site address before enabling search indexing.",
      });
  });

export const seoSaveSchema = z
  .object({
    input: seoInputSchema,
    expectedRevision: z.number().int().min(0),
    operationId: z.string().uuid(),
  })
  .strict();
export type SeoInput = z.infer<typeof seoInputSchema>;
export type SeoSettings = { input: SeoInput; revision: number };

// Only explicitly published public pages on the canonical production host opt in.
export function seoIndexingAllowed(
  input: SeoInput,
  environment: {
    nodeEnv?: string;
    vercelEnv?: string;
    host: string;
    mode: string;
  },
) {
  return (
    input.indexingEnabled &&
    !!input.siteUrl &&
    environment.mode === "staff" &&
    environment.nodeEnv === "production" &&
    (!environment.vercelEnv || environment.vercelEnv === "production") &&
    environment.host.toLowerCase() === new URL(input.siteUrl).host
  );
}

export const seoPublicPaths = [
  "/",
  "/art",
  "/shop",
  "/appearances",
  "/contact",
] as const;
export function seoSitemapUrls(
  origin: string,
  slugs: string[],
  productIds: string[] = [],
  collectionIds: string[] = [],
) {
  return [
    ...seoPublicPaths.map((path) => new URL(path, origin).href),
    ...new Set(
      slugs.map(
        (slug) => new URL(`/art/${encodeURIComponent(slug)}`, origin).href,
      ),
    ),
    ...new Set(
      productIds.map(
        (id) => new URL(`/shop/${encodeURIComponent(id)}`, origin).href,
      ),
    ),
    ...new Set(
      collectionIds.map(
        (id) =>
          new URL(`/shop/collections/${encodeURIComponent(id)}`, origin).href,
      ),
    ),
  ];
}

export function seoWebsiteData(input: SeoInput) {
  if (!input.siteUrl) return null;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Sadboi Studios",
    alternateName: "Sadboi Studio",
    url: input.siteUrl + "/",
    description: input.homeDescription,
    creator: {
      "@type": "Person",
      name: "Joel Hedstrom",
      alternateName: "Sadboi",
      sameAs: [input.instagramUrl, input.xUrl].filter(Boolean),
    },
  };
}
export const seoJsonLd = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c");
