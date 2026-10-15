import { cache } from "react";
import { notFound } from "next/navigation";
import { publicCatalog } from "@/server/public-catalog";
import { publicGallery } from "@/server/gallery";
import { publicShopCollections } from "@/server/shop-collections";
import { publicPageMetadata } from "@/server/seo";
import { shippingSettings } from "@/server/shipping";
import { ShopCatalog } from "@/components/shop-catalog";
import { GalleryGrid } from "@/components/gallery-grid";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
const collectionForPage = cache(async (id: string) => {
  if (!/^[a-f0-9]{64}$/.test(id)) return null;
  const [catalog, works] = await Promise.all([
    publicCatalog(),
    publicGallery(),
  ]);
  const collections = await publicShopCollections(catalog.products, works);
  const collection = collections.find((item) => item.id === id);
  if (!collection) return null;
  return {
    catalog,
    collections,
    collection,
    works: collection.artworkIds.flatMap((id) => {
      const work = works.find((item) => item.id === id);
      return work ? [work] : [];
    }),
  };
});
export async function generateMetadata({ params }: Props) {
  const result = await collectionForPage((await params).id);
  if (!result) notFound();
  const product = result.catalog.products.find(
    (item) => item.id === result.collection.productIds[0],
  );
  const image =
    product?.imageUrl ??
    product?.variants.find((item) => item.imageUrl)?.imageUrl ??
    (result.works[0]
      ? `/api/gallery/images/${result.works[0].id}?w=960`
      : undefined);
  return publicPageMetadata(`/shop/collections/${result.collection.id}`, {
    title: result.collection.title,
    description:
      result.collection.description.slice(0, 160) ||
      `Explore ${result.collection.title}, a collection of artwork and editions from Sadboi Studio.`,
    ...(image ? { image: { path: image, alt: result.collection.title } } : {}),
  });
}
export default async function Page({ params }: Props) {
  const result = await collectionForPage((await params).id);
  if (!result) notFound();
  return (
    <main className="shop-shell">
      <ShopCatalog
        key={result.collection.id}
        products={result.catalog.products}
        collection={result.collection}
        collections={result.collections.map(({ id, title }) => ({ id, title }))}
        shipping={await shippingSettings()}
      />
      {!!result.works.length && (
        <section className="shop-collection-art">
          <h2>Artwork in this collection</h2>
          <GalleryGrid works={result.works} />
        </section>
      )}
      <footer className="shop-footer">
        <span>sadboi / studio</span>
        <span>Private studio editions · Made with intention</span>
      </footer>
    </main>
  );
}
