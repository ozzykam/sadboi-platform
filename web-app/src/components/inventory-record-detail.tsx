import Link from "next/link";
import { Eye, Pencil, Plus, ArrowLeft, Boxes } from "lucide-react";
import type { InventoryCatalog } from "@sadboi/core";
import { Badge } from "./ui";
import { InventoryPhoto } from "./inventory-photo";
import { InventoryImageGallery } from "./inventory-image-gallery";

const money = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    minor / 100,
  );
const label = (text: string) => text.replaceAll("_", " ");
function Facts({
  items,
}: {
  items: Array<[string, string | undefined | null]>;
}) {
  return (
    <dl className="inv-record-facts">
      {items.map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{value || "Not specified"}</dd>
        </div>
      ))}
    </dl>
  );
}
function Dates({
  createdAt,
  updatedAt,
}: {
  createdAt: string;
  updatedAt: string;
}) {
  return (
    <p className="field-hint inv-record-dates">
      {createdAt && (
        <>
          Created <time dateTime={createdAt}>{createdAt.slice(0, 10)}</time>
          .{" "}
        </>
      )}
      {updatedAt && (
        <>
          Last updated{" "}
          <time dateTime={updatedAt}>{updatedAt.slice(0, 10)}</time>.
        </>
      )}
    </p>
  );
}
export function InventoryRecordDetail({
  catalog,
  resource,
  id,
  canEdit,
}: {
  catalog: InventoryCatalog;
  resource: "products" | "variants";
  id: string;
  canEdit: boolean;
}) {
  const variant =
    resource === "variants"
      ? catalog.variants.find((item) => item.id === id)
      : undefined;
  const product = catalog.products.find(
    (item) => item.id === (variant?.productId ?? id),
  );
  const record = variant ?? product;
  if (!record) return null;
  const title = variant?.name ?? product!.title;
  const variants = catalog.variants.filter(
    (item) => item.productId === product?.id,
  );
  const back =
    variant && product
      ? `/admin/inventory/products/${product.id}`
      : "/admin/inventory";
  return (
    <div className="inv-record-page">
      <Link href={back} className="inline-link inv-record-back">
        <ArrowLeft size={16} aria-hidden="true" />
        {variant && product ? product.title : "All products"}
      </Link>
      <header className="inv-record-heading">
        <div>
          <p className="eyebrow">
            INVENTORY / {variant ? "VARIATION" : "PRODUCT"}
          </p>
          <h1>{title}</h1>
          <div className="inv-record-badges">
            <Badge>{record.status === "active" ? "Active" : "Archived"}</Badge>
            <Badge>
              {record.publication === "public" ? "Public catalog" : "Private"}
            </Badge>
          </div>
        </div>
        {canEdit && (
          <Link
            className="button secondary"
            href={`/admin/inventory/${resource}/${id}/edit`}
          >
            <Pencil size={16} aria-hidden="true" /> Edit{" "}
            {variant ? "variation" : "product"}
          </Link>
        )}
      </header>
      <div className="inv-record-overview">
        {variant ? (
          <InventoryImageGallery
            id={id}
            assetIds={
              variant.imageAssetIds ??
              (variant.imageAssetId ? [variant.imageAssetId] : [])
            }
            title={title}
          />
        ) : (
          <div className="inv-record-image">
            <InventoryPhoto
              resource="products"
              id={id}
              assetId={record.imageAssetId}
              alt={title}
            />
          </div>
        )}
        <section
          className="inv-record-copy"
          aria-label={`${variant ? "Variation" : "Product"} information`}
        >
          {variant && (
            <p className="inv-record-price">
              {money(variant.priceMinor)} <small>USD</small>
            </p>
          )}
          <h2>Description</h2>
          <p className="preserve-lines">
            {record.description || "No description added yet."}
          </p>
          {variant ? (
            <>
              <Facts
                items={[
                  ["SKU", variant.sku],
                  ["Size", variant.size],
                  ["Color", variant.color],
                  ["Material", variant.material],
                  ["Finish", variant.finish],
                  [
                    "Weight",
                    variant.weightGrams == null
                      ? null
                      : `${variant.weightGrams} g`,
                  ],
                  ["Fulfillment", label(variant.fulfillment)],
                ]}
              />
              {product && (
                <p>
                  Part of{" "}
                  <Link
                    className="inline-link"
                    href={`/admin/inventory/products/${product.id}`}
                  >
                    {product.title}
                  </Link>
                </p>
              )}
              <Link
                className="button secondary"
                href={`/admin/inventory?variant=${id}`}
              >
                <Boxes size={17} aria-hidden="true" /> View stock &amp; history
              </Link>
            </>
          ) : (
            <>
              <Facts
                items={[
                  ["Product type", label(product!.kind)],
                  ["Variations", String(variants.length)],
                ]}
              />
              <div className="inv-actions">
                {canEdit && (
                  <Link
                    className="inline-link"
                    href={`/admin/artworks/${product!.artworkId}`}
                  >
                    View original artwork
                  </Link>
                )}
                {record.status === "active" &&
                  record.publication === "public" && (
                    <Link className="inline-link" href={`/shop/${id}`}>
                      View in shop
                    </Link>
                  )}
              </div>
            </>
          )}
          <Dates createdAt={record.createdAt} updatedAt={record.updatedAt} />
        </section>
      </div>
      {!variant && (
        <section
          className="inv-record-variations"
          aria-labelledby="inventory-variations-title"
        >
          <div className="section-heading">
            <h2 id="inventory-variations-title">
              Variations <span className="field-hint">({variants.length})</span>
            </h2>
            {canEdit && record.status === "active" && (
              <Link
                className="button secondary"
                href={`/admin/inventory/variants/new/edit?product=${id}`}
              >
                <Plus size={16} aria-hidden="true" /> Add variation
              </Link>
            )}
          </div>
          {variants.length ? (
            <div className="contacts-table-wrap">
              <table className="contacts-table inv-variation-table">
                <thead>
                  <tr>
                    <th scope="col">Variation</th>
                    <th scope="col">SKU</th>
                    <th scope="col">Price</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link
                          className="inv-variation-link"
                          href={`/admin/inventory/variants/${item.id}`}
                        >
                          <span className="inv-variation-thumb">
                            <InventoryPhoto
                              resource="variants"
                              id={item.id}
                              assetId={
                                item.imageAssetIds?.[0] ?? item.imageAssetId
                              }
                              alt=""
                            />
                          </span>
                          <span>
                            <strong>{item.name}</strong>
                            <small>
                              {[
                                item.size,
                                item.color,
                                item.material,
                                item.finish,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "Standard"}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>{item.sku}</td>
                      <td>{money(item.priceMinor)}</td>
                      <td>
                        <span>
                          {item.status === "active" ? "Active" : "Archived"}
                        </span>
                        <small>
                          {item.publication === "public"
                            ? "Public catalog"
                            : "Private"}
                        </small>
                      </td>
                      <td>
                        <div className="inv-table-actions">
                          <Link
                            className="inv-card-icon"
                            href={`/admin/inventory/variants/${item.id}`}
                            aria-label={`View ${item.name}`}
                            title="View variation"
                          >
                            <Eye size={18} aria-hidden="true" />
                          </Link>
                          {canEdit && (
                            <Link
                              className="inv-card-icon"
                              href={`/admin/inventory/variants/${item.id}/edit`}
                              aria-label={`Edit ${item.name}`}
                              title="Edit variation"
                            >
                              <Pencil size={17} aria-hidden="true" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>
                No variations yet. Add a size or style to give this product a
                price and SKU.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
