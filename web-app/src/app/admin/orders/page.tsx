import { requireStaff } from "@/server/staff";
import { storeOrderCatalog } from "@/server/store-orders";
import { StoreOrdersAdmin } from "@/components/store-orders-admin";
import Link from "next/link";
export default async function OrdersPage() {
  await requireStaff(["super_admin", "accounting"]);
  return (
    <>
      <Link className="inline-link" href="/admin/how-to#store-orders">
        How to review shop order requests
      </Link>
      <StoreOrdersAdmin initial={await storeOrderCatalog()} />
    </>
  );
}
