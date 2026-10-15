import "server-only";
import { randomUUID } from "node:crypto";
import { adminServices, artworkBucket } from "./firebase";
import { artworkRef, onlyKeys, operationId, recordId } from "./artworks";
import { AccessError, businessId, type Staff } from "./staff";

export async function removeArtworkImage(
  id: string,
  assetId: string,
  body: Record<string, unknown>,
  staff: Staff,
) {
  if (staff.role !== "super_admin")
    throw new AccessError(
      403,
      "forbidden",
      "Only studio administrators can remove images.",
    );
  onlyKeys(body, ["operationId"]);
  const key = operationId(body.operationId);
  const art = artworkRef(id),
    asset = art.collection("assets").doc(recordId(assetId));
  const publicRef = adminServices().db.doc(
    `businesses/${businessId}/gallery/${id}`,
  );
  const { db } = adminServices();
  const paths = await db.runTransaction(async (tx) => {
    const [parent, image, published] = await tx.getAll(art, asset, publicRef);
    if (!parent.exists || !image.exists)
      throw new AccessError(404, "not-found", "Image not found.");
    const data = image.data()!,
      artwork = parent.data()!;
    if (data.status === "deleted") return null;
    if (!["ready", "deleting"].includes(data.status))
      throw new AccessError(
        409,
        "image-busy",
        "Wait for this upload to finish before removing it.",
      );
    if (
      (artwork.gallery?.published && artwork.gallery.assetId === assetId) ||
      (published.data()?.published && published.data()?.assetId === assetId)
    ) {
      throw new AccessError(
        409,
        "published-image",
        "This image is in the public gallery. Choose another image and Update gallery, or Unpublish the artwork, before removing it.",
      );
    }
    const storedPaths = [data.originalPath, data.previewPath];
    const prefix = `businesses/${businessId}/artworks/${id}/${assetId}/`;
    if (
      storedPaths.some(
        (path) =>
          typeof path !== "string" ||
          !path.startsWith(prefix) ||
          path.includes(".."),
      )
    )
      throw new AccessError(
        409,
        "invalid-image",
        "Image storage details need review before removal.",
      );
    if (data.status === "deleting") return storedPaths as string[];
    const remaining = await tx.get(
      art.collection("assets").where("status", "==", "ready"),
    );
    const replacement = remaining.docs
      .filter((doc) => doc.id !== assetId)
      .sort(
        (a, b) =>
          String(b.data().createdAt).localeCompare(
            String(a.data().createdAt),
          ) || a.id.localeCompare(b.id),
      )[0];
    tx.update(asset, {
      status: "deleting",
      removedAt: new Date().toISOString(),
      removedBy: staff.uid,
      removalOperation: key,
    });
    tx.update(art, {
      assetCount: Math.max(0, (artwork.assetCount ?? 0) - 1),
      ...(artwork.coverAssetId === assetId
        ? { coverAssetId: replacement?.id ?? null }
        : {}),
    });
    tx.create(art.collection("events").doc(randomUUID()), {
      kind: "image-removed",
      actorId: staff.uid,
      at: new Date().toISOString(),
      assetId,
      filename: data.filename,
    });
    return storedPaths as string[];
  });
  if (paths) {
    // Hide the asset before touching storage; retries resume this durable cleanup.
    const results = await Promise.allSettled(
      paths.map((path) =>
        artworkBucket().file(path).delete({ ignoreNotFound: true }),
      ),
    );
    if (results.some((result) => result.status === "rejected"))
      throw new AccessError(
        503,
        "cleanup-pending",
        "The image is no longer available, but file cleanup is incomplete. Choose Retry removal to finish.",
      );
    await asset.update({
      status: "deleted",
      deletedAt: new Date().toISOString(),
    });
  }
  return { assetId };
}
