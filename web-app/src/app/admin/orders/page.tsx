import { requireStaff } from "@/server/staff";
import { storeOrderCatalog } from "@/server/store-orders";
import { StoreOrdersAdmin } from "@/components/store-orders-admin";
import Link from "next/link";
export default async function OrdersPage() {
  const staff = await requireStaff(["super_admin", "accounting"]);
  return (
    <>
      <Link className="inline-link" href="/admin/how-to#fulfillment">
        How to fulfill shop orders
      </Link>
      <StoreOrdersAdmin initial={await storeOrderCatalog()} canEdit={staff.role === "super_admin"} />
    </>
  );
}
