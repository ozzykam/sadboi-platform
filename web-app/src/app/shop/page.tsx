import { publicCatalog } from "@/server/public-catalog";
import { ShopCatalog } from "@/components/shop-catalog";
import { shippingSettings } from "@/server/shipping";
import { publicPageMetadata } from "@/server/seo";

export const dynamic = "force-dynamic";
export const generateMetadata = () =>
  publicPageMetadata("/shop", {
    title: "Shop",
    description:
      "Shop Sadboi Studio editions and merchandise featuring original artwork by Joel Hedstrom.",
  });

export default async function ShopPage() {
  const [catalog, shipping] = await Promise.all([
    publicCatalog(),
    shippingSettings(),
  ]);
  return (
    <main className="shop-shell">
      <ShopCatalog products={catalog.products} shipping={shipping} />
      <footer className="shop-footer">
        <span>sadboi / studio</span>
        <span>Private studio editions · Made with intention</span>
      </footer>
    </main>
  );
}
