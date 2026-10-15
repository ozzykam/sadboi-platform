import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { defaultSeoInput, seoIndexingAllowed } from "@sadboi/core";
import { seoSettings } from "./seo-settings";
import { getMode } from "./mode";

export const publicSeo = cache(async () => {
  const host = (await headers()).get("host") ?? "";
  const mode = getMode();
  let input = defaultSeoInput;
  if (mode === "staff") {
    try {
      input = (await seoSettings()).input;
    } catch {
      console.error(
        "Website SEO settings unavailable; using noindex defaults.",
      );
    }
  }
  return {
    input,
    indexable: seoIndexingAllowed(input, {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      host,
      mode,
    }),
  };
});

export async function publicPageMetadata(
  path: string,
  options?: {
    title: string;
    description: string;
    image?: { path: string; alt: string; width: number; height: number };
  },
): Promise<Metadata> {
  const { input, indexable } = await publicSeo();
  const title = options?.title ?? input.homeTitle;
  const description = options?.description ?? input.homeDescription;
  const canonical = input.siteUrl
    ? new URL(path, input.siteUrl).href
    : undefined;
  const image = options?.image ?? {
    path: "/images/shared-image.webp",
    alt: "Sadboi logo with hand-drawn lettering and a skull on a dark background",
    width: 1192,
    height: 633,
  };
  const images = input.siteUrl
    ? [
        {
          url: new URL(image.path, input.siteUrl).href,
          alt: image.alt,
          width: image.width,
          height: image.height,
        },
      ]
    : [];
  const shareTitle = path === "/" ? title : `${title} · Sadboi Studio`;
  return {
    title: path === "/" ? { absolute: title } : title,
    description,
    ...(input.siteUrl
      ? { metadataBase: new URL(input.siteUrl), alternates: { canonical } }
      : {}),
    robots: {
      index: indexable,
      follow: true,
      ...(indexable
        ? {
            googleBot: {
              index: true,
              follow: true,
              "max-image-preview": "large" as const,
            },
          }
        : {}),
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "Sadboi Studios",
      title: shareTitle,
      description,
      ...(canonical ? { url: canonical } : {}),
      images,
    },
    twitter: {
      card: "summary_large_image",
      ...(input.xUrl
        ? { creator: `@${new URL(input.xUrl).pathname.split("/")[1]}` }
        : {}),
      title: shareTitle,
      description,
      images,
    },
    ...(path === "/" && input.googleVerification
      ? { verification: { google: input.googleVerification } }
      : {}),
  };
}
