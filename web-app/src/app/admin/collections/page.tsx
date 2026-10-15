import { requireStaff } from "@/server/staff";
import { listShopCollections } from "@/server/shop-collections";
import { publicCatalog } from "@/server/public-catalog";
import { publicGallery } from "@/server/gallery";
import { ShopCollectionsAdmin } from "@/components/shop-collections-admin";
export default async function Page() {
  const staff = await requireStaff(["super_admin"]);
  const [initial, catalog, works] = await Promise.all([
    listShopCollections(staff),
    publicCatalog(),
    publicGallery(),
  ]);
  return (
    <ShopCollectionsAdmin
      initial={initial}
      products={catalog.products.map(({ id, title }) => ({ id, title }))}
      works={works.map(({ id, title }) => ({ id, title }))}
    />
  );
}
