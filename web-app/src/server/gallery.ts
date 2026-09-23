import "server-only";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { FieldPath } from "firebase-admin/firestore";
import {
  galleryInputSchema,
  gallerySlug,
  artworkInputSchema,
  type PublicArtwork,
} from "@sadboi/core";
import { adminServices, artworkBucket } from "./firebase";
import {
  artworkRef,
  getArtwork,
  onlyKeys,
  operationId,
  recordId,
} from "./artworks";
import { AccessError, businessId, type Staff } from "./staff";

const galleryCollection = () =>
  adminServices().db.collection(`businesses/${businessId}/gallery`);

export async function publishArtwork(
  id: string,
  body: Record<string, unknown>,
  staff: Staff,
) {
  if (staff.role !== "super_admin")
    throw new AccessError(
      403,
      "forbidden",
      "Only studio administrators can publish artwork.",
    );
  onlyKeys(body, ["input", "revision", "operationId"]);
  const parsed = galleryInputSchema.safeParse(body.input);
  if (!parsed.success)
    throw new AccessError(
      400,
      "validation",
      parsed.error.issues.map((issue) => issue.message).join(" "),
    );
  const input = parsed.data,
    key = operationId(body.operationId);
  if (!Number.isSafeInteger(body.revision) || (body.revision as number) < 1)
    throw new AccessError(400, "validation", "A record version is required.");
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const ref = artworkRef(id);
  await adminServices().db.runTransaction(async (tx) => {
    const record = await tx.get(ref),
      data = record.data();
    if (!data) throw new AccessError(404, "not-found", "Artwork not found.");
    if (
      data.lastGalleryOperation === key &&
      data.lastGalleryHash === hash &&
      data.lastGalleryActor === staff.uid &&
      data.lastGalleryRevision === data.revision
    )
      return;
    if (data.revision !== body.revision)
      throw new AccessError(
        409,
        "conflict",
        "This artwork changed. Open the latest saved version before publishing; your choices are still here.",
      );
    const art = artworkInputSchema.parse(data.input);
    const slug = data.gallery?.slug ?? gallerySlug(art.title, id);
    let dimensions: { width: number; height: number } | null = null;
    if (input.published) {
      if (art.status !== "ready" || art.rights === "review")
        throw new AccessError(
          400,
          "validation",
          "Save this artwork as Ready for review and resolve its rights classification before publishing.",
        );
      const asset = (
        await tx.get(ref.collection("assets").doc(input.assetId!))
      ).data();
      if (asset?.status !== "ready" || !asset.previewPath)
        throw new AccessError(
          400,
          "validation",
          "Choose a completed image belonging to this artwork.",
        );
      // Use the stripped, orientation-corrected display copy, never the original.
      const [bytes] = await artworkBucket().file(asset.previewPath).download();
      const metadata = await sharp(bytes).metadata();
      if (!metadata.width || !metadata.height)
        throw new AccessError(
          400,
          "validation",
          "The display image is unavailable. Upload it again before publishing.",
        );
      dimensions = { width: metadata.width, height: metadata.height };
    }
    const now = new Date().toISOString(),
      revision = data.revision + 1;
    tx.update(ref, {
      gallery: { ...input, slug, publishedRevision: revision },
      revision,
      updatedAt: now,
      updatedBy: staff.uid,
      lastGalleryOperation: key,
      lastGalleryHash: hash,
      lastGalleryActor: staff.uid,
      lastGalleryRevision: revision,
    });
    const publicRef = galleryCollection().doc(id);
    if (input.published && dimensions) {
      tx.set(publicRef, {
        published: true,
        assetId: input.assetId,
        work: {
          id,
          slug,
          title: art.title,
          series: art.series,
          year: art.year,
          medium: art.medium,
          description: art.description,
          tags: art.tags,
          alt: input.alt,
          caption: input.caption,
          credits: input.credits,
          order: input.order,
          ...dimensions,
        },
      });
    } else tx.set(publicRef, { published: false });
    tx.create(ref.collection("events").doc(randomUUID()), {
      kind: input.published ? "gallery-published" : "gallery-unpublished",
      actorId: staff.uid,
      at: now,
      revision,
    });
  });
  return getArtwork(id, staff);
}

function publicProjection(data: FirebaseFirestore.DocumentData): PublicArtwork {
  const w = data.work;
  return {
    id: w.id,
    slug: w.slug,
    title: w.title,
    series: w.series,
    year: w.year,
    medium: w.medium,
    description: w.description,
    tags: w.tags,
    alt: w.alt,
    caption: w.caption,
    credits: w.credits,
    order: w.order,
    width: w.width,
    height: w.height,
  };
}

export async function publicGallery(): Promise<PublicArtwork[]> {
  const works: PublicArtwork[] = [];
  let cursor: string | undefined;
  // Read every published record; never silently truncate the artist's archive.
  for (;;) {
    let query = galleryCollection()
      .where("published", "==", true)
      .orderBy(FieldPath.documentId())
      .limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    works.push(...page.docs.map((doc) => publicProjection(doc.data())));
    if (page.size < 100) break;
    cursor = page.docs.at(-1)!.id;
  }
  return works.sort(
    (a, b) =>
      a.order - b.order ||
      b.year - a.year ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id),
  );
}

export async function publicArtwork(
  slug: string,
): Promise<PublicArtwork | null> {
  const id = slug.match(/-([a-f0-9]{64})$/)?.[1];
  if (!id) return null;
  const data = (await galleryCollection().doc(id).get()).data();
  return data?.published === true && data.work?.slug === slug
    ? publicProjection(data)
    : null;
}

export async function galleryImage(id: string, width: number) {
  recordId(id);
  const data = (await galleryCollection().doc(id).get()).data();
  if (data?.published !== true)
    throw new AccessError(404, "not-found", "Image not found.");
  const asset = (
    await artworkRef(id).collection("assets").doc(recordId(data.assetId)).get()
  ).data();
  if (asset?.status !== "ready" || !asset.previewPath)
    throw new AccessError(404, "not-found", "Image not found.");
  const [preview] = await artworkBucket().file(asset.previewPath).download();
  const bytes = await sharp(preview)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": 'inline; filename="sadboi-artwork.webp"',
    },
  });
}

export async function artworkShopLinks(artworkId: string) {
  const docs = await adminServices()
    .db.collection(`businesses/${businessId}/products`)
    .where("input.artworkId", "==", artworkId)
    .get();
  return docs.docs
    .filter(
      (doc) =>
        doc.data().input.status === "active" &&
        doc.data().input.publication === "public",
    )
    .map((doc) => ({ id: doc.id, title: String(doc.data().input.title) }));
}
