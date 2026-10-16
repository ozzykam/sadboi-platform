import { InventoryRecordDetail } from "@/components/inventory-record-detail";
import { inventoryPageData } from "@/server/inventory-pages";

export default async function Page({
  params,
}: {
  params: Promise<{ resource: string; id: string }>;
}) {
  const { resource, id } = await params;
  return <InventoryRecordDetail {...await inventoryPageData(resource, id)} />;
}
