import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { galleryOrderSchema } from "@sadboi/core";
import { adminServices } from "./firebase";
import { artworkRef, getArtwork, onlyKeys, operationId } from "./artworks";
import { AccessError, businessId, type Staff } from "./staff";

export async function saveGalleryOrder(
  body: Record<string, unknown>,
  staff: Staff,
) {
  if (staff.role !== "super_admin")
    throw new AccessError(
      403,
      "forbidden",
      "Only studio administrators can change gallery order.",
    );
  onlyKeys(body, ["entries", "operationId"]);
  const parsed = galleryOrderSchema.safeParse(body.entries);
  if (!parsed.success)
    throw new AccessError(
      400,
      "validation",
      "Provide 1–100 distinct artwork records with whole-number display orders from 0 to 999999 and their saved versions.",
    );
  const entries = parsed.data.sort((a, b) => a.id.localeCompare(b.id));
  const key = operationId(body.operationId);
  const hash = createHash("sha256")
    .update(JSON.stringify(entries))
    .digest("hex");
  const { db } = adminServices();
  const business = db.collection("businesses").doc(businessId);
  const receipt = business
    .collection("galleryOrderOperations")
    .doc(createHash("sha256").update(`${staff.uid}:${key}`).digest("hex"));
  await db.runTransaction(async (tx) => {
    const previous = await tx.get(receipt);
    if (previous.exists) {
      if (previous.data()!.hash !== hash)
        throw new AccessError(
          409,
          "conflict",
          "This save request was already used for a different order. Reload the catalog before trying again.",
        );
      return;
    }
    const refs = entries.map((entry) => artworkRef(entry.id));
    const publicRefs = entries.map((entry) =>
      business.collection("gallery").doc(entry.id),
    );
    const records = await tx.getAll(...refs, ...publicRefs);
    // Validate every record before writing: one stale item rejects the entire save.
    entries.forEach((entry, index) => {
      const data = records[index].data();
      const published = records[index + entries.length].data();
      if (!data)
        throw new AccessError(
          404,
          "not-found",
          "An artwork no longer exists. Reload the catalog; no order changes were saved.",
        );
      if (data.revision !== entry.revision)
        throw new AccessError(
          409,
          "conflict",
          "An artwork changed since this catalog was loaded. Reload the catalog before applying your order again; no order changes were saved.",
        );
      if (
        !data.gallery?.published ||
        published?.published !== true ||
        !published.work
      )
        throw new AccessError(
          409,
          "conflict",
          "Only published artwork can be reordered. Reload the catalog; no order changes were saved.",
        );
    });
    const now = new Date().toISOString();
    entries.forEach((entry, index) => {
      const data = records[index].data()!;
      const revision = data.revision + 1;
      tx.update(refs[index], {
        "gallery.order": entry.order,
        // Keep any unpublished artwork edits pending; ordering never republishes them.
        "gallery.publishedRevision":
          data.gallery.publishedRevision === data.revision
            ? revision
            : data.gallery.publishedRevision,
        revision,
        updatedAt: now,
        updatedBy: staff.uid,
      });
      tx.update(publicRefs[index], { "work.order": entry.order });
      tx.create(refs[index].collection("events").doc(randomUUID()), {
        kind: "gallery-order-changed",
        actorId: staff.uid,
        at: now,
        revision,
        previousOrder: data.gallery.order,
        order: entry.order,
      });
    });
    tx.create(receipt, { hash, actorId: staff.uid, at: now });
  });
  return Promise.all(entries.map((entry) => getArtwork(entry.id, staff)));
}
