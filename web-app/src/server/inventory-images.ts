import "server-only";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { inventoryImages } from "./inventory-image-reference";
import { adminServices, artworkBucket } from "./firebase";
import { AccessError, businessId } from "./staff";
import { inventoryStaff, inventoryId } from "./inventory";
import { boundedBody, validateMutation } from "./auth-http";
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
  await validateMutation(request);
  inventoryId(id);
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
  if (
    resource === "variants" &&
    new URL(request.url).searchParams.get("append") === "1" &&
    inventoryImages(record.data()!).length >= 12
  )
    throw new AccessError(
      400,
      "image-limit",
      "A variation can have up to 12 images. Remove an image before adding another.",
    );
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
  const images = await adminServices().db.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists)
      throw new AccessError(404, "not-found", "Inventory record not found.");
    const existing =
      resource === "variants" ? inventoryImages(current.data()!) : [];
    const append =
      resource === "variants" &&
      new URL(request.url).searchParams.get("append") === "1";
    if (append && existing.length >= 12)
      throw new AccessError(
        400,
        "image-limit",
        "A variation can have up to 12 images. Remove an image before adding another.",
      );
    const next = append
      ? [...existing, { assetId, path }]
      : [{ assetId, path }, ...existing.slice(1)];
    tx.update(ref, {
      ...(resource === "variants" ? { catalogImages: next } : {}),
      "input.imageAssetId": next[0].assetId,
      imagePath: next[0].path,
      imageUpdatedAt: new Date().toISOString(),
      imageUpdatedBy: staff.uid,
    });
    return next.map((image) => image.assetId);
  });
  return { assetId, assetIds: images };
}
export async function setVariantCover(
  id: string,
  assetId: string,
  request: Request,
) {
  const staff = await inventoryStaff(true);
  await validateMutation(request);
  inventoryId(id);
  if (!/^[a-f0-9-]{36}$/.test(assetId))
    throw new AccessError(400, "invalid-image", "Choose a saved image.");
  const ref = adminServices().db.doc(
    `businesses/${businessId}/productVariants/${id}`,
  );
  return adminServices().db.runTransaction(async (tx) => {
    const record = await tx.get(ref);
    if (!record.exists)
      throw new AccessError(404, "not-found", "Variation not found.");
    const images = inventoryImages(record.data()!);
    const cover = images.find((image) => image.assetId === assetId);
    if (!cover)
      throw new AccessError(
        404,
        "not-found",
        "Image no longer belongs to this variation. Reopen the variation and try again.",
      );
    const ordered = [
      cover,
      ...images.filter((image) => image.assetId !== assetId),
    ];
    tx.update(ref, {
      catalogImages: ordered,
      "input.imageAssetId": cover.assetId,
      imagePath: cover.path,
      imageUpdatedAt: new Date().toISOString(),
      imageUpdatedBy: staff.uid,
    });
    return { assetIds: ordered.map((image) => image.assetId) };
  });
}
export async function removeVariantImage(
  id: string,
  assetId: string,
  request: Request,
) {
  const staff = await inventoryStaff(true);
  await validateMutation(request);
  inventoryId(id);
  if (!/^[a-f0-9-]{36}$/.test(assetId))
    throw new AccessError(400, "invalid-image", "Choose a saved image.");
  const ref = adminServices().db.doc(
    `businesses/${businessId}/productVariants/${id}`,
  );
  return adminServices().db.runTransaction(async (tx) => {
    const record = await tx.get(ref);
    if (!record.exists)
      throw new AccessError(404, "not-found", "Variation not found.");
    const images = inventoryImages(record.data()!).filter(
      (image) => image.assetId !== assetId,
    );
    tx.update(ref, {
      catalogImages: images,
      "input.imageAssetId": images[0]?.assetId ?? FieldValue.delete(),
      imagePath: images[0]?.path ?? FieldValue.delete(),
      imageUpdatedAt: new Date().toISOString(),
      imageUpdatedBy: staff.uid,
    });
    return { assetIds: images.map((image) => image.assetId) };
  });
}
export async function readStaffInventoryImage(
  resource: ImageResource,
  id: string,
  assetId?: string | null,
) {
  await inventoryStaff();
  inventoryId(id);
  const record = await adminServices()
    .db.doc(`businesses/${businessId}/${collections[resource]}/${id}`)
    .get();
  const data = record.data();
  const path =
    data &&
    (assetId
      ? inventoryImages(data).find((image) => image.assetId === assetId)?.path
      : data.imagePath);
  if (!path) throw new AccessError(404, "not-found", "Image not found.");
  const [bytes] = await artworkBucket().file(path).download();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function readInventoryImage(
  resource: ImageResource,
  id: string,
  assetId?: string | null,
) {
  const ref = adminServices()
    .db.collection(`businesses/${businessId}/${collections[resource]}`)
    .doc(id);
  const record = await ref.get();
  const data = record.data();
  if (resource === "variants" && data) {
    const parent = await adminServices()
      .db.doc(`businesses/${businessId}/products/${data.input.productId}`)
      .get();
    if (
      parent.data()?.input?.status !== "active" ||
      parent.data()?.input?.publication !== "public"
    )
      throw new AccessError(404, "not-found", "Image not found.");
  }
  const path =
    data &&
    (assetId
      ? inventoryImages(data).find((image) => image.assetId === assetId)?.path
      : data.imagePath);
  if (
    !record.exists ||
    data?.input?.status !== "active" ||
    data?.input?.publication !== "public" ||
    !path
  )
    throw new AccessError(404, "not-found", "Image not found.");
  const [bytes] = await artworkBucket().file(path).download();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
