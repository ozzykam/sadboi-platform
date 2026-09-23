export type StoreCartLine = {
  variantId: string;
  quantity: number;
  variantName: string;
  productTitle: string;
  priceMinor: number;
};
type CartProduct = {
  title: string;
  variants: Array<{
    id: string;
    name: string;
    priceMinor: number;
    available: number;
    fulfillment: string;
  }>;
};

// Saved cart metadata is untrusted and can be outdated. Rebuild it from the
// public catalog and keep quantities within the order and availability limits.
export function restoreStoreCart(
  raw: unknown,
  products: CartProduct[],
): StoreCartLine[] {
  if (!Array.isArray(raw)) return [];
  const catalog = new Map(
    products.flatMap((product) =>
      product.variants.map(
        (variant) => [variant.id, { product, variant }] as const,
      ),
    ),
  );
  const lines = new Map<string, StoreCartLine>();
  for (const value of raw.slice(0, 1000)) {
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.variantId !== "string" ||
      !Number.isSafeInteger(value.quantity) ||
      value.quantity < 1 ||
      value.quantity > 1000
    )
      continue;
    const entry = catalog.get(value.variantId);
    if (!entry) continue;
    const { product, variant } = entry;
    const max =
      variant.fulfillment === "made_to_order"
        ? 1000
        : Math.min(1000, variant.available);
    if (max < 1 || (!lines.has(value.variantId) && lines.size >= 20)) continue;
    lines.set(value.variantId, {
      variantId: variant.id,
      quantity: Math.min(
        max,
        (lines.get(variant.id)?.quantity ?? 0) + value.quantity,
      ),
      variantName: variant.name,
      productTitle: product.title,
      priceMinor: variant.priceMinor,
    });
  }
  return [...lines.values()];
}
