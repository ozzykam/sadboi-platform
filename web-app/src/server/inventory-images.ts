import "server-only";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { adminServices, artworkBucket } from "./firebase";
import { AccessError, businessId } from "./staff";
import { inventoryStaff } from "./inventory";
import { boundedBody } from "./auth-http";
const collections = {
  products: "products",
  variants: "productVariants",
} as const;
const maxBytes = 12 * 1024 * 1024;
export type ImageResource = keyof typeof collections;
export function imageResource(value: string): value is ImageResource {
  return value === "products" || value === "variants";
}
export async function uploadInventoryImage(
  resource: ImageResource,
  id: string,
  request: Request,
) {
  const staff = await inventoryStaff(true);
  const buffer = await boundedBody(request, maxBytes);
  if (!buffer.length)
    throw new AccessError(400, "empty-file", "Choose an image to upload.");
  const contentType = "image/webp";
  try {
    const image = sharp(buffer, {
      limitInputPixels: 100_000_000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      !["jpeg", "png", "webp"].includes(metadata.format ?? "")
    )
      throw new Error();
  } catch {
    throw new AccessError(
      400,
      "invalid-image",
      "Use a valid JPEG, PNG, or WebP image up to 12 MB.",
    );
  }
  const ref = adminServices()
    .db.collection(`businesses/${businessId}/${collections[resource]}`)
    .doc(id);
  const record = await ref.get();
  if (!record.exists)
    throw new AccessError(404, "not-found", "Inventory record not found.");
  const assetId = randomUUID();
  const path = `businesses/${businessId}/catalog/${resource}/${id}/${assetId}.webp`;
  const preview = await sharp(buffer)
    .rotate()
    .resize({
      width: 1800,
      height: 1800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 88 })
    .toBuffer();
  await artworkBucket()
    .file(path)
    .save(preview, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType, cacheControl: "public, max-age=3600" },
    });
  await ref.update({
    "input.imageAssetId": assetId,
    imagePath: path,
    imageUpdatedAt: new Date().toISOString(),
    imageUpdatedBy: staff.uid,
  });
  return { assetId };
}
export async function readInventoryImage(resource: ImageResource, id: string) {
  const ref = adminServices()
    .db.collection(`businesses/${businessId}/${collections[resource]}`)
    .doc(id);
  const record = await ref.get();
  const data = record.data();
  if (
    !record.exists ||
    data?.input?.status !== "active" ||
    data?.input?.publication !== "public" ||
    !data.imagePath
  )
    throw new AccessError(404, "not-found", "Image not found.");
  const [bytes] = await artworkBucket().file(data.imagePath).download();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
