import "server-only";
import { createHash } from "node:crypto";
import { FieldPath } from "firebase-admin/firestore";
import {
  shopCollectionCommandSchema,
  shopCollectionInputSchema,
  type ShopCollectionRecord,
  type PublicCollection,
} from "@sadboi/core";
import { adminServices } from "./firebase";
import { AccessError, businessId, type Staff } from "./staff";
import { publicCatalog, type PublicCatalogItem } from "./public-catalog";
import { publicGallery } from "./gallery";
import type { PublicArtwork } from "@sadboi/core";

const collections = () =>
  adminServices().db.collection(`businesses/${businessId}/shopCollections`);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function project(
  doc: FirebaseFirestore.DocumentSnapshot,
): ShopCollectionRecord {
  const data = doc.data()!;
  return {
    id: doc.id,
    revision: data.revision,
    input: shopCollectionInputSchema.parse(data.input),
    published: data.published === true,
    publishedRevision: data.publishedRevision ?? null,
    archived: data.archived === true,
    updatedAt: data.updatedAt,
  };
}
async function all(query: FirebaseFirestore.Query) {
  const docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let cursor: string | undefined;
  for (;;) {
    let pageQuery = query.orderBy(FieldPath.documentId()).limit(100);
    if (cursor) pageQuery = pageQuery.startAfter(cursor);
    const page = await pageQuery.get();
    docs.push(...page.docs);
    if (page.size < 100) return docs;
    cursor = page.docs.at(-1)!.id;
  }
}
export async function listShopCollections(staff: Staff) {
  if (staff.role !== "super_admin")
    throw new AccessError(
      403,
      "forbidden",
      "Only super admins manage collections.",
    );
  return (await all(collections()))
    .map(project)
    .sort(
      (a, b) =>
        a.input.order - b.input.order ||
        a.input.title.localeCompare(b.input.title),
    );
}
export async function saveShopCollection(raw: unknown, staff: Staff) {
  if (staff.role !== "super_admin")
    throw new AccessError(
      403,
      "forbidden",
      "Only super admins manage collections.",
    );
  const parsed = shopCollectionCommandSchema.safeParse(raw);
  if (!parsed.success)
    throw new AccessError(
      400,
      "validation",
      parsed.error.issues.map((issue) => issue.message).join(" "),
    );
  const command = parsed.data;
  if (
    command.action === "save" &&
    (command.id === null ? command.revision !== 0 : command.revision < 1)
  )
    throw new AccessError(
      400,
      "validation",
      "Use the saved collection version, or version zero for a new collection.",
    );
  const id = command.id ?? hash(`${staff.uid}:${command.operationId}`);
  const ref = collections().doc(id);
  const db = adminServices().db;
  const receipt = db.doc(
    `businesses/${businessId}/shopCollectionOperations/${hash(`${staff.uid}:${command.operationId}`)}`,
  );
  const fingerprint = hash(JSON.stringify(command));
  await db.runTransaction(async (tx) => {
    const [record, previous] = await tx.getAll(ref, receipt);
    if (previous.exists) {
      if (previous.data()!.hash !== fingerprint)
        throw new AccessError(
          409,
          "conflict",
          "This request was already used for different changes. Reload before retrying.",
        );
      return;
    }
    const current = record.data();
    if (command.id && !current)
      throw new AccessError(404, "not-found", "Collection not found.");
    if ((current?.revision ?? 0) !== command.revision)
      throw new AccessError(
        409,
        "conflict",
        "This collection changed in another session. Keep a copy of your edits, reload, and apply them to the latest version.",
      );
    if (current?.archived && !["restore", "archive"].includes(command.action))
      throw new AccessError(
        409,
        "archived",
        "Restore this collection before changing it.",
      );
    const input =
      command.action === "save"
        ? command.input
        : shopCollectionInputSchema.parse(current!.input);
    if (command.action === "publish") {
      if (!input.productIds.length && !input.artworkIds.length)
        throw new AccessError(
          400,
          "empty-collection",
          "Add at least one public product or artwork before publishing.",
        );
      const refs = [
        ...input.productIds.map((item) =>
          db.doc(`businesses/${businessId}/products/${item}`),
        ),
        ...input.artworkIds.map((item) =>
          db.doc(`businesses/${businessId}/gallery/${item}`),
        ),
      ];
      const items = await tx.getAll(...refs);
      if (
        items.some((item, index) =>
          index < input.productIds.length
            ? item.data()?.input?.publication !== "public" ||
              item.data()?.input?.status !== "active"
            : item.data()?.published !== true,
        )
      )
        throw new AccessError(
          409,
          "unavailable-items",
          "Some selected items are no longer public. Remove them from the draft or publish them separately before publishing this collection.",
        );
    }
    const now = new Date().toISOString(),
      revision = (current?.revision ?? 0) + 1;
    const publication =
      command.action === "publish"
        ? {
            published: true,
            publishedInput: input,
            publishedRevision: revision,
          }
        : ["unpublish", "archive", "restore"].includes(command.action)
          ? { published: false, publishedInput: null, publishedRevision: null }
          : {};
    tx.set(ref, {
      ...(current ?? {
        published: false,
        publishedInput: null,
        publishedRevision: null,
        archived: false,
        createdAt: now,
      }),
      input,
      revision,
      updatedAt: now,
      updatedBy: staff.uid,
      ...publication,
      ...(command.action === "archive"
        ? { archived: true }
        : command.action === "restore"
          ? { archived: false }
          : {}),
    });
    tx.create(receipt, {
      hash: fingerprint,
      collectionId: id,
      actorId: staff.uid,
      at: now,
    });
    tx.create(ref.collection("events").doc(receipt.id), {
      action: command.action,
      actorId: staff.uid,
      at: now,
      revision,
      ...(command.action === "save" || command.action === "publish"
        ? { input }
        : {}),
    });
  });
  return project(await ref.get());
}

// Recheck membership visibility on every request. Collection publishing never
// publishes a private product/artwork, and a withdrawn item cannot leak its ID.
export async function publicShopCollections(
  products?: PublicCatalogItem[],
  works?: PublicArtwork[],
): Promise<PublicCollection[]> {
  const [records, currentProducts, currentWorks] = await Promise.all([
    all(collections().where("published", "==", true)),
    products ?? publicCatalog().then((catalog) => catalog.products),
    works ?? publicGallery(),
  ]);
  const productIds = new Set(currentProducts.map((item) => item.id)),
    artworkIds = new Set(currentWorks.map((item) => item.id));
  return records
    .flatMap((doc) => {
      const data = doc.data(),
        input = shopCollectionInputSchema.safeParse(data.publishedInput);
      if (data.archived || !input.success) return [];
      const visible = {
        ...input.data,
        productIds: input.data.productIds.filter((id) => productIds.has(id)),
        artworkIds: input.data.artworkIds.filter((id) => artworkIds.has(id)),
        id: doc.id,
      };
      return visible.productIds.length || visible.artworkIds.length
        ? [visible]
        : [];
    })
    .sort(
      (a, b) =>
        a.order - b.order ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id),
    );
}
