import "server-only";
import { notFound } from "next/navigation";
import { requireStaff } from "./staff";
import { inventoryCatalog } from "./inventory";

export async function inventoryPageData(
  resource: string,
  id: string,
  editing = false,
) {
  const staff = await requireStaff(
    editing ? ["super_admin"] : ["super_admin", "accounting"],
  );
  if (resource !== "products" && resource !== "variants") notFound();
  if (!/^[a-f0-9]{64}$/.test(id) && !(editing && id === "new")) notFound();
  const catalog = await inventoryCatalog();
  if (id !== "new" && !catalog[resource].some((record) => record.id === id))
    notFound();
  return { catalog, resource, id, canEdit: staff.role === "super_admin" } as const;
}
