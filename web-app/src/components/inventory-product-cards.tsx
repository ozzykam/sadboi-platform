import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import type { ProductRecord } from "@sadboi/core";
import { InventoryPhoto } from "./inventory-photo";

export function InventoryProductCards({
  products,
  canEdit,
}: {
  products: ProductRecord[];
  canEdit: boolean;
}) {
  return (
    <div className="inv-product-grid">
      {products.map((product) => (
        <article className="inv-product-card" key={product.id}>
          <div className="inv-product-card-image">
            <InventoryPhoto
              resource="products"
              id={product.id}
              assetId={product.imageAssetId}
              alt={product.title}
            />
            {canEdit && (
              <Link
                className="inv-card-icon inv-card-edit"
                href={`/admin/inventory/products/${product.id}/edit`}
                aria-label={`Edit ${product.title}`}
                title="Edit product"
              >
                <Pencil size={19} aria-hidden="true" />
              </Link>
            )}
            <Link
              className="inv-card-icon inv-card-view"
              href={`/admin/inventory/products/${product.id}`}
              aria-label={`View ${product.title}`}
              title="View product"
            >
              <Eye size={21} aria-hidden="true" />
            </Link>
          </div>
          <h2>
            <Link href={`/admin/inventory/products/${product.id}`}>
              {product.title}
            </Link>
          </h2>
        </article>
      ))}
    </div>
  );
}
