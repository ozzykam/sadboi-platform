import { publicCatalog } from "@/server/public-catalog";
import { ShopCatalog } from "@/components/shop-catalog";
import { shippingSettings } from "@/server/shipping";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const [catalog, shipping] = await Promise.all([publicCatalog(), shippingSettings()]);
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
