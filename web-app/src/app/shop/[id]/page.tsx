import { cache } from "react";
import { notFound } from "next/navigation";
import { publicCatalog } from "@/server/public-catalog";
import { publicPageMetadata } from "@/server/seo";
import { shippingSettings } from "@/server/shipping";
import { ShopCatalog } from "@/components/shop-catalog";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };
const productForPage = cache(async (id: string) => {
  if (!/^[a-f0-9]{64}$/.test(id)) return null;
  const catalog = await publicCatalog();
  const product = catalog.products.find((item) => item.id === id);
  return product ? { catalog, product } : null;
});

export async function generateMetadata({ params }: Props) {
  const result = await productForPage((await params).id);
  if (!result) notFound();
  const { product } = result;
  const image =
    product.imageUrl ??
    product.variants.find((variant) => variant.imageUrl)?.imageUrl;
  return publicPageMetadata(`/shop/${product.id}`, {
    title: product.title,
    description:
      product.description.trim().slice(0, 160) ||
      `${product.title} — a ${product.kind} from Sadboi Studio. Browse available variations and prices.`,
    ...(image ? { image: { path: image, alt: product.title } } : {}),
  });
}

export default async function ProductPage({ params }: Props) {
  const result = await productForPage((await params).id);
  if (!result) notFound();
  const shipping = await shippingSettings();
  return (
    <main className="shop-shell">
      <ShopCatalog
        key={result.product.id}
        products={result.catalog.products}
        shipping={shipping}
        detailProduct={result.product}
      />
      <footer className="shop-footer">
        <span>sadboi / studio</span>
        <span>Private studio editions · Made with intention</span>
      </footer>
    </main>
  );
}
