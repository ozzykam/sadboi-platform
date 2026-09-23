import { publicCatalog } from "@/server/public-catalog";
import { ShopCatalog } from "@/components/shop-catalog";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const catalog = await publicCatalog();
  return (
    <main className="shop-shell">
      <ShopCatalog products={catalog.products} />
      <footer className="shop-footer">
        <span>sadboi / studio</span>
        <span>Private studio editions · Made with intention</span>
      </footer>
    </main>
  );
}
