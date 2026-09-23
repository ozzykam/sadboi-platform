import { artworkInputSchema, artworkSchema, catalogSchema, type Catalog } from "./catalog";
import { emptyCatalog } from "./fixtures";

export function parsePreviewCatalog(value: unknown): Catalog {
  const catalog = catalogSchema.parse(value);
  if (catalog.businessId !== emptyCatalog.businessId) throw new Error("This file belongs to a different workspace.");
  return catalog;
}

export function saveArtworkDraft(catalog: Catalog, input: unknown, recordId: string, now: string): Catalog {
  const current = parsePreviewCatalog(catalog);
  const fields = artworkInputSchema.parse(input);
  const existing = current.artworks.find((art) => art.id === recordId);
  const record = artworkSchema.parse({ ...fields, id: recordId, businessId: current.businessId,
    createdAt: existing?.createdAt ?? now, updatedAt: now });
  return parsePreviewCatalog({ ...current,
    artworks: existing ? current.artworks.map((art) => art.id === recordId ? record : art) : [record, ...current.artworks],
  });
}
