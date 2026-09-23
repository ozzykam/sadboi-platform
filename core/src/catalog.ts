import { z } from "zod";

const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const text = (max: number) => z.string().trim().max(max);
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const artworkInputSchema = z.object({
  title: text(160).min(1, "Give this artwork a title."),
  series: text(120),
  year: z.number().int().min(1000).max(9999),
  medium: text(120).min(1, "Add a medium or technique."),
  description: text(5000),
  status: z.enum(["draft", "ready", "archived"]),
  rights: z.enum(["owned", "licensed", "review"]),
  tags: z.array(text(40).min(1)).max(20),
  pixelWidth: z.number().int().min(1).max(100000).nullable(),
  pixelHeight: z.number().int().min(1).max(100000).nullable(),
  colorProfile: text(100),
  internalNotes: text(5000),
}).strict().refine((value) => (value.pixelWidth === null) === (value.pixelHeight === null), {
  message: "Enter both pixel dimensions, or leave both blank.", path: ["pixelHeight"],
});

export const artworkSchema = artworkInputSchema.safeExtend({
  id, businessId: id, createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
});
export type ArtworkInput = z.infer<typeof artworkInputSchema>;
export type Artwork = z.infer<typeof artworkSchema>;

export const moneySchema = z.object({
  amountMinor: count,
  currency: z.string().regex(/^[A-Z]{3}$/),
}).strict();

export const variantSchema = z.object({
  id, businessId: id, artworkId: id, sku: text(80).min(1),
  name: text(160).min(1), options: text(200), price: moneySchema,
  fulfillment: z.enum(["stocked", "made_to_order"]),
}).strict();
export type Variant = z.infer<typeof variantSchema>;

export const locationSchema = z.object({
  id, businessId: id, name: text(120).min(1),
  kind: z.enum(["studio", "gallery", "event", "transit"]),
  onlineEligible: z.boolean(),
}).strict();
export type Location = z.infer<typeof locationSchema>;

export const stockSchema = z.object({
  businessId: id, variantId: id, locationId: id,
  onHand: count, reserved: count, allocated: count, unavailable: count,
}).strict().refine((stock) => stock.reserved + stock.allocated + stock.unavailable <= stock.onHand,
  "Stock commitments cannot exceed physical stock.");
export type Stock = z.infer<typeof stockSchema>;

export function availableStock(value: Stock): number {
  const stock = stockSchema.parse(value);
  return stock.onHand - stock.reserved - stock.allocated - stock.unavailable;
}

// Pure transition only. A production repository must execute this inside a transaction.
export function reserveStock(value: Stock, quantity: number): Stock {
  const stock = stockSchema.parse(value);
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(quantity);
  if (availableStock(stock) < quantity) throw new Error("Not enough available stock.");
  return stockSchema.parse({ ...stock, reserved: stock.reserved + quantity });
}

export const catalogSchema = z.object({
  version: z.literal(1), businessId: id,
  artworks: z.array(artworkSchema).max(1000),
  variants: z.array(variantSchema).max(5000),
  locations: z.array(locationSchema).max(100),
  stock: z.array(stockSchema).max(10000),
}).strict().superRefine((catalog, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  for (const records of [catalog.artworks, catalog.variants, catalog.locations]) {
    if (new Set(records.map((record) => record.id)).size !== records.length) issue("Duplicate record ID.");
    if (records.some((record) => record.businessId !== catalog.businessId)) issue("Cross-business record.");
  }
  if (new Set(catalog.variants.map((v) => v.sku.toLowerCase())).size !== catalog.variants.length) issue("Duplicate SKU.");
  if (new Set(catalog.stock.map((s) => `${s.variantId}/${s.locationId}`)).size !== catalog.stock.length) issue("Duplicate stock balance.");
  for (const variant of catalog.variants) {
    if (!catalog.artworks.some((art) => art.id === variant.artworkId)) issue("Variant has no artwork.");
  }
  for (const stock of catalog.stock) {
    if (stock.businessId !== catalog.businessId) issue("Cross-business stock.");
    if (!catalog.variants.some((v) => v.id === stock.variantId)) issue("Stock has no variant.");
    if (!catalog.locations.some((l) => l.id === stock.locationId)) issue("Stock has no location.");
  }
});
export type Catalog = z.infer<typeof catalogSchema>;

export function onlineAvailable(catalog: Catalog, variantId: string): number {
  const valid = catalogSchema.parse(catalog);
  return valid.stock.filter((s) => s.variantId === variantId && valid.locations.some((l) =>
    l.id === s.locationId && l.onlineEligible && l.kind !== "transit"))
    .reduce((sum, stock) => sum + availableStock(stock), 0);
}

export function artworkPreview(artwork: Artwork) {
  // Explicit projection. Never spread private records into public responses.
  return { id: artwork.id, title: artwork.title, series: artwork.series,
    year: artwork.year, medium: artwork.medium, description: artwork.description, tags: artwork.tags };
}
