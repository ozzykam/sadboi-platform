import "server-only";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { artworkUploadLimit, type ArtworkAsset } from "@sadboi/core";
import { adminServices, artworkBucket } from "./firebase";
import { AccessError, type Staff } from "./staff";
import { artworkRef, getArtwork, operationId, recordId } from "./artworks";
import { boundedBody } from "./auth-http";

const types: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  tiff: "image/tiff",
};
function projection(
  id: string,
  data: FirebaseFirestore.DocumentData,
): ArtworkAsset {
  return {
    id,
    filename: data.filename,
    contentType: data.contentType,
    bytes: data.bytes,
    width: data.width,
    height: data.height,
    sha256: data.sha256,
    createdAt: data.createdAt,
    ...(data.status === "deleting" ? { removalPending: true } : {}),
  };
}
export async function listAssets(id: string, staff: Staff) {
  await getArtwork(id, staff);
  const records = await artworkRef(id)
    .collection("assets")
    .where(
      "status",
      "in",
      staff.role === "super_admin" ? ["ready", "deleting"] : ["ready"],
    )
    .get();
  return records.docs
    .map((doc) => projection(doc.id, doc.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function uploadAsset(
  id: string,
  request: Request,
  staff: Staff,
): Promise<ArtworkAsset> {
  const art = artworkRef(id);
  await getArtwork(id, staff);
  const uploadId = operationId(request.headers.get("x-upload-id"));
  let filename: string;
  try {
    filename = decodeURIComponent(
      request.headers.get("x-file-name") ?? "artwork",
    )
      .replace(/[\x00-\x1f\x7f/\\]/g, "_")
      .slice(0, 180);
  } catch {
    throw new AccessError(400, "filename", "The filename is invalid.");
  }
  const buffer = await boundedBody(request, artworkUploadLimit);
  if (!buffer.length)
    throw new AccessError(400, "empty-file", "Choose an image to upload.");
  let width: number, height: number, format: string, preview: Buffer;
  try {
    const image = sharp(buffer, {
      limitInputPixels: 100_000_000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    format = metadata.format ?? "";
    if (
      !types[format] ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages ?? 1) !== 1
    )
      throw new Error();
    width = metadata.width;
    height = metadata.height;
    preview = await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .timeout({ seconds: 20 })
      .toBuffer();
  } catch {
    throw new AccessError(
      400,
      "invalid-image",
      "Use a valid, single-image JPEG, PNG, WebP, or TIFF, up to 30 MB and 100 megapixels.",
    );
  }
  const declared = request.headers.get("content-type")?.split(";")[0];
  if (declared !== types[format])
    throw new AccessError(
      400,
      "image-type",
      "The file contents do not match its image type.",
    );
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const assetId = createHash("sha256")
    .update(staff.uid + ":" + uploadId)
    .digest("hex");
  const ref = art.collection("assets").doc(assetId),
    { db } = adminServices();
  const attempt = randomUUID(),
    createdAt = new Date().toISOString();
  const prefix =
    "businesses/sadboi/artworks/" + id + "/" + assetId + "/" + attempt;
  const originalPath = prefix + "/original",
    previewPath = prefix + "/preview.webp";
  const attemptRef = ref.collection("attempts").doc(attempt);
  const record = {
    filename,
    contentType: types[format],
    bytes: buffer.length,
    width,
    height,
    sha256,
    createdAt,
    createdBy: staff.uid,
    status: "processing",
    attempt,
    startedAt: Date.now(),
    originalPath,
    previewPath,
  };
  const existing = await db.runTransaction(async (tx) => {
    const parent = await tx.get(art),
      upload = await tx.get(ref);
    if (!parent.exists)
      throw new AccessError(404, "not-found", "Artwork not found.");
    if (upload.exists) {
      const current = upload.data()!;
      if (["deleting", "deleted"].includes(current.status))
        throw new AccessError(
          409,
          "removed-image",
          "This image was removed. Select the file again to start a new upload.",
        );
      if (current.sha256 !== sha256)
        throw new AccessError(
          409,
          "conflict",
          "That upload request belongs to a different file. Select the file again.",
        );
      if (current.status === "ready") return projection(assetId, current);
      if (
        current.status === "processing" &&
        Date.now() - current.startedAt < 120000
      )
        throw new AccessError(
          409,
          "upload-pending",
          "This upload is still processing. Wait a moment before retrying.",
        );
    }
    if ((parent.data()!.assetCount ?? 0) >= 100)
      throw new AccessError(
        409,
        "asset-limit",
        "This artwork has reached its 100-image limit.",
      );
    tx.set(ref, record);
    tx.create(attemptRef, {
      originalPath,
      previewPath,
      status: "processing",
      createdAt,
    });
    return null;
  });
  if (existing) return existing;
  const bucket = artworkBucket();
  try {
    await bucket.file(originalPath).save(buffer, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: types[format],
        cacheControl: "private, no-store",
        contentDisposition: "attachment",
      },
    });
    await bucket.file(previewPath).save(preview, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: "image/webp",
        cacheControl: "private, no-store",
      },
    });
    await db.runTransaction(async (tx) => {
      const parent = await tx.get(art),
        current = await tx.get(ref);
      if (
        !parent.exists ||
        current.data()?.attempt !== attempt ||
        current.data()?.status !== "processing"
      )
        throw new AccessError(
          409,
          "conflict",
          "Upload state changed. Please retry.",
        );
      if ((parent.data()!.assetCount ?? 0) >= 100)
        throw new AccessError(
          409,
          "asset-limit",
          "This artwork has reached its image limit.",
        );
      tx.update(ref, {
        status: "ready",
        completedAt: new Date().toISOString(),
      });
      tx.update(attemptRef, { status: "ready" });
      // Image changes are independent from the optimistic version of metadata.
      tx.update(art, {
        coverAssetId: assetId,
        assetCount: (parent.data()!.assetCount ?? 0) + 1,
      });
      tx.create(art.collection("events").doc(randomUUID()), {
        kind: "image-added",
        actorId: staff.uid,
        at: createdAt,
        assetId,
        sha256,
      });
    });
    return projection(assetId, record);
  } catch (error) {
    // A commit can succeed even when its acknowledgement is lost. Confirm its
    // state before removing files; never delete a completed original.
    const committed = await db.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (["deleting", "deleted"].includes(current.data()?.status))
        throw new AccessError(
          409,
          "removed-image",
          "This image was removed. Select the file again to start a new upload.",
        );
      if (
        current.data()?.attempt === attempt &&
        current.data()?.status === "ready"
      )
        return projection(assetId, current.data()!);
      if (current.data()?.attempt === attempt)
        tx.update(ref, {
          status: "failed",
          failedAt: new Date().toISOString(),
        });
      tx.update(attemptRef, { status: "cleanup-pending" });
      return null;
    });
    if (committed) return committed;
    const cleanup = await Promise.allSettled([
      bucket.file(originalPath).delete({ ignoreNotFound: true }),
      bucket.file(previewPath).delete({ ignoreNotFound: true }),
    ]);
    await attemptRef
      .update({
        status: cleanup.every((result) => result.status === "fulfilled")
          ? "cleaned"
          : "cleanup-pending",
      })
      .catch(() =>
        console.error("Artwork upload cleanup needs reconciliation", {
          assetId,
          attempt,
        }),
      );
    throw error;
  }
}
export async function readAsset(
  id: string,
  assetId: string,
  original: boolean,
  staff: Staff,
) {
  recordId(assetId);
  if (original && staff.role !== "super_admin")
    throw new AccessError(
      403,
      "forbidden",
      "Only studio administrators can download original files.",
    );
  await getArtwork(id, staff);
  const data = (
    await artworkRef(id).collection("assets").doc(assetId).get()
  ).data();
  if (data?.status !== "ready")
    throw new AccessError(404, "not-found", "Image not found.");
  // Stored paths are created by this service, never accepted from the browser.
  const [bytes] = await artworkBucket()
    .file(original ? data.originalPath : data.previewPath)
    .download();
  const filename = original
    ? data.filename.replace(/[^a-zA-Z0-9._-]/g, "_")
    : "artwork-preview.webp";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": original ? data.contentType : "image/webp",
      "Content-Length": String(bytes.length),
      "Content-Disposition":
        (original ? "attachment" : "inline") + '; filename="' + filename + '"',
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
