import { Inventory } from "@/components/inventory";
import { SharedInventory } from "@/components/shared-inventory";
import { inventoryCatalog } from "@/server/inventory";
import { getMode } from "@/server/mode";
import { requireStaff } from "@/server/staff";
export default async function Page() {
  if (getMode() === "locked") return null;
  if (getMode() === "staff") {
    const staff = await requireStaff(["super_admin", "accounting"]);
    return (
      <SharedInventory
        initial={await inventoryCatalog()}
        canEdit={staff.role === "super_admin"}
      />
    );
  }
  return <Inventory />;
}
