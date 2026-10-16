"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { InventoryCatalog } from "@sadboi/core";
import { MetadataEditor } from "./shared-inventory";

export function InventoryRecordEditor({
  catalog: initial,
  resource,
  id,
  productId,
}: {
  catalog: InventoryCatalog;
  resource: "products" | "variants";
  id: string;
  productId?: string;
}) {
  const [catalog, setCatalog] = useState(initial);
  const router = useRouter();
  const record = catalog[resource].find((item) => item.id === id);
  const back =
    id === "new"
      ? productId
        ? `/admin/inventory/products/${productId}`
        : "/admin/inventory"
      : `/admin/inventory/${resource}/${id}`;
  return (
    <div className="inv-record-editor">
      <Link href={back} className="inline-link">
        ← {record ? "Back to details" : "Back to inventory"}
      </Link>
      <MetadataEditor
        editing={{ resource, id, productId }}
        catalog={catalog}
        onClose={() => {
          router.push(back);
          router.refresh();
        }}
        onSaved={async (savedId) => {
          router.push(`/admin/inventory/${resource}/${savedId}`);
          router.refresh();
        }}
        onVariantImagesChange={(variantId, assetIds) =>
          setCatalog((current) => ({
            ...current,
            variants: current.variants.map((variant) =>
              variant.id === variantId
                ? {
                    ...variant,
                    imageAssetIds: assetIds,
                    imageAssetId: assetIds[0],
                  }
                : variant,
            ),
          }))
        }
      />
    </div>
  );
}
