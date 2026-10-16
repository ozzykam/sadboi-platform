import { Inventory } from "@/components/inventory";
import { SharedInventory } from "@/components/shared-inventory";
import { inventoryCatalog } from "@/server/inventory";
import { getMode } from "@/server/mode";
import { requireStaff } from "@/server/staff";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  if (getMode() === "locked") return null;
  if (getMode() === "staff") {
    const staff = await requireStaff(["super_admin", "accounting"]);
    const catalog = await inventoryCatalog();
    const { variant } = await searchParams;
    const selected = catalog.variants.find((item) => item.id === variant)?.id;
    return (
      <SharedInventory
        key={selected ?? "catalog"}
        initial={catalog}
        canEdit={staff.role === "super_admin"}
        initialVariant={selected}
      />
    );
  }
  return <Inventory />;
}
