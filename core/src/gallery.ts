import { z } from "zod";

export const galleryInputSchema = z
  .object({
    published: z.boolean(),
    assetId: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    alt: z.string().trim().max(500),
    caption: z.string().trim().max(1000),
    credits: z.string().trim().max(1000),
    order: z.number().int().min(0).max(999999),
    rightsConfirmed: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.published) return;
    if (!value.assetId)
      ctx.addIssue({
        code: "custom",
        path: ["assetId"],
        message: "Choose a gallery image.",
      });
    if (!value.alt)
      ctx.addIssue({
        code: "custom",
        path: ["alt"],
        message: "Describe the image for visitors using a screen reader.",
      });
    if (!value.rightsConfirmed)
      ctx.addIssue({
        code: "custom",
        path: ["rightsConfirmed"],
        message: "Confirm permission to display this work publicly.",
      });
  });

export type GalleryInput = z.infer<typeof galleryInputSchema>;
export type GallerySettings = GalleryInput & {
  slug: string;
  publishedRevision: number;
};
export type PublicArtwork = {
  id: string;
  slug: string;
  title: string;
  series: string;
  year: number;
  medium: string;
  description: string;
  tags: string[];
  alt: string;
  caption: string;
  credits: string;
  order: number;
  width: number;
  height: number;
};

export function gallerySlug(title: string, id: string) {
  const stem = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70)
    .replace(/-$/, "");
  return `${stem || "artwork"}-${id}`;
}
