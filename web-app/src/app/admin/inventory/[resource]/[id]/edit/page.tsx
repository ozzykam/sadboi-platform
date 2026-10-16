import { notFound } from "next/navigation";
import { InventoryRecordEditor } from "@/components/inventory-record-editor";
import { inventoryPageData } from "@/server/inventory-pages";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string; id: string }>;
  searchParams: Promise<{ product?: string }>;
}) {
  const { resource, id } = await params;
  const data = await inventoryPageData(resource, id, true);
  const { product } = await searchParams;
  if (
    resource === "variants" &&
    id === "new" &&
    !data.catalog.products.some(
      (item) => item.id === product && item.status === "active",
    )
  )
    notFound();
  return (
    <InventoryRecordEditor
      key={`${resource}:${id}`}
      {...data}
      productId={product}
    />
  );
}
