import { catalogSchema, type Catalog } from "./catalog";

export const emptyCatalog: Catalog = {
  version: 1, businessId: "sadboi-local-preview", artworks: [], variants: [], locations: [], stock: [],
};

// Entirely fictional examples. These are not Joel's artwork or business records.
export function sampleCatalog(): Catalog {
  const businessId = emptyCatalog.businessId;
  const date = "2026-09-16T12:00:00.000Z";
  return catalogSchema.parse({
    version: 1, businessId,
    artworks: [
      { id: "sample-01", title: "Study in vermilion", series: "Example studies", status: "ready", rights: "owned" },
      { id: "sample-02", title: "An unfinished landscape", series: "Example studies", status: "draft", rights: "review" },
      { id: "sample-03", title: "Notes on light", series: "Example studies", status: "ready", rights: "licensed" },
    ].map((art) => ({ ...art, businessId, year: 2026, medium: "Digital painting", description: "A fictional sample to explore the catalog workflow.", tags: ["sample"], pixelWidth: 4800, pixelHeight: 6000, colorProfile: "sRGB", internalNotes: "Example only. Replace with real records after secure storage is connected.", createdAt: date, updatedAt: date })),
    variants: [
      { id: "print-01", businessId, artworkId: "sample-01", sku: "DEMO-VER-12", name: "Study in vermilion / print", options: "12 × 16 in · unframed", price: { amountMinor: 4500, currency: "USD" }, fulfillment: "stocked" },
      { id: "print-02", businessId, artworkId: "sample-01", sku: "DEMO-VER-18", name: "Study in vermilion / large print", options: "18 × 24 in · unframed", price: { amountMinor: 7500, currency: "USD" }, fulfillment: "stocked" },
    ],
    locations: [
      { id: "studio", businessId, name: "Example studio", kind: "studio", onlineEligible: true },
      { id: "gallery", businessId, name: "Example gallery", kind: "gallery", onlineEligible: false },
    ],
    stock: [
      { businessId, variantId: "print-01", locationId: "studio", onHand: 20, reserved: 2, allocated: 3, unavailable: 1 },
      { businessId, variantId: "print-01", locationId: "gallery", onHand: 5, reserved: 0, allocated: 0, unavailable: 0 },
      { businessId, variantId: "print-02", locationId: "studio", onHand: 4, reserved: 0, allocated: 0, unavailable: 0 },
    ],
  });
}
