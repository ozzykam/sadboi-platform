import "server-only";
import { adminServices } from "./firebase";
import { businessId } from "./staff";
import {
  inventoryImageAssetId,
  inventoryImages,
} from "./inventory-image-reference";
import {
  stockAvailable,
  type ProductInput,
  type StockVariantInput,
} from "@sadboi/core";
const collection = (name: string) =>
  adminServices().db.collection("businesses/" + businessId + "/" + name);
export type PublicCatalogItem = ProductInput & {
  id: string;
  imageUrl?: string;
  variants: Array<
    StockVariantInput & {
      id: string;
      available: number;
      imageUrl?: string;
      imageUrls?: string[];
    }
  >;
};
export async function publicCatalog(): Promise<{
  products: PublicCatalogItem[];
}> {
  const [products, variants, locations, balances] = await Promise.all([
    collection("products")
      .where("input.status", "==", "active")
      .where("input.publication", "==", "public")
      .limit(501)
      .get(),
    collection("productVariants")
      .where("input.status", "==", "active")
      .where("input.publication", "==", "public")
      .limit(501)
      .get(),
    collection("stockLocations")
      .where("input.status", "==", "active")
      .where("input.onlineEligible", "==", true)
      .limit(101)
      .get(),
    collection("stockBalances").limit(1001).get(),
  ]);
  const online = new Set(locations.docs.map((doc) => doc.id));
  const available = new Map<string, number>();
  balances.docs.forEach((doc) => {
    const data = doc.data();
    if (online.has(data.locationId))
      available.set(
        data.variantId,
        (available.get(data.variantId) ?? 0) +
          stockAvailable({
            variantId: data.variantId,
            locationId: data.locationId,
            onHand: data.onHand ?? 0,
            reserved: data.reserved ?? 0,
            allocated: data.allocated ?? 0,
            unavailable: data.unavailable ?? 0,
            revision: data.revision ?? 0,
          }),
      );
  });
  const publicProducts = new Set(products.docs.map((doc) => doc.id));
  return {
    products: products.docs
      .map((doc) => ({
        ...doc.data().input,
        id: doc.id,
        imageUrl: inventoryImageAssetId(doc.data())
          ? `/api/store/catalog/images/products/${doc.id}?v=${encodeURIComponent(inventoryImageAssetId(doc.data())!)}`
          : undefined,
        variants: variants.docs
          .filter(
            (variant) =>
              variant.data().input.productId === doc.id &&
              publicProducts.has(doc.id),
          )
          .map((variant) => ({
            ...variant.data().input,
            imageUrls: inventoryImages(variant.data()).map(
              (image) =>
                `/api/store/catalog/images/variants/${variant.id}?asset=${encodeURIComponent(image.assetId)}`,
            ),
            id: variant.id,
            available: available.get(variant.id) ?? 0,
            imageUrl: inventoryImageAssetId(variant.data())
              ? `/api/store/catalog/images/variants/${variant.id}?v=${encodeURIComponent(inventoryImageAssetId(variant.data())!)}`
              : undefined,
          })),
      }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };
}
