"use client";
import Link from "next/link";
import { useRef } from "react";
import { ArrowLeft, Expand } from "lucide-react";
import type { PublicCatalogItem } from "@/server/public-catalog";
import { CatalogImage } from "./catalog-image";
import { StoreOrderForm, type StoreCartLine } from "./store-order-form";

export function ShopProductDetail({
  product,
  onAddToCart,
  onViewCart,
  disabled,
  pending,
}: {
  product: PublicCatalogItem;
  onAddToCart: (lines: StoreCartLine[]) => void;
  onViewCart: () => void;
  disabled: boolean;
  pending: boolean;
}) {
  const viewer = useRef<HTMLDialogElement>(null);
  const image =
    product.imageUrl ??
    product.variants.find((variant) => variant.imageUrl)?.imageUrl;
  const lowest = product.variants.length
    ? Math.min(...product.variants.map((variant) => variant.priceMinor))
    : null;
  return (
    <article className="shop-product-detail">
      <Link className="shop-product-back" href="/shop">
        <ArrowLeft size={16} aria-hidden="true" /> All products
      </Link>
      <div className="shop-product-detail-layout">
        <div className="shop-product-detail-image">
          {image ? (
            <button
              type="button"
              className="shop-product-detail-image-button"
              onClick={() => viewer.current?.showModal()}
              aria-label={`Enlarge ${product.title}`}
            >
              <CatalogImage
                variant="shop"
                src={image}
                alt={product.title}
                sizes="(max-width: 760px) 100vw, 50vw"
              />
              <span className="shop-product-enlarge">
                <Expand size={16} aria-hidden="true" /> View image
              </span>
            </button>
          ) : (
            <p className="shop-product-image-empty">Image coming soon</p>
          )}
        </div>
        <section className="shop-product-detail-content">
          <p className="eyebrow">Shop / {product.kind}</p>
          <h1>{product.title}</h1>
          {lowest !== null && (
            <p className="shop-product-detail-price">
              From ${(lowest / 100).toFixed(2)} <small>USD</small>
            </p>
          )}
          <div className="shop-dialog-description preserve-lines">
            <p>
              {product.description ||
                "A studio edition from the Sadboi catalog."}
            </p>
          </div>
          {pending && (
            <p role="status" className="notice">
              Your previous order request needs confirmation. Open your cart to
              recover it before adding items.
            </p>
          )}
          {product.variants.length ? (
            <StoreOrderForm
              product={product}
              onAddToCart={onAddToCart}
              disabled={disabled}
            />
          ) : (
            <p className="notice">
              No variations are available to order right now. Please check back
              or contact the studio.
            </p>
          )}
          <div className="shop-product-detail-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onViewCart}
            >
              View cart
            </button>
            <Link className="inline-link" href="/contact">
              Ask about this product
            </Link>
          </div>
          <p className="shop-order-note">
            Adding to your cart does not reserve stock. Current availability,
            shipping and totals are checked before an order is requested.
          </p>
        </section>
      </div>
      {image && (
        <dialog
          ref={viewer}
          className="shop-product-viewer"
          aria-label={`${product.title} enlarged image`}
          onClick={(event) => {
            if (event.target === event.currentTarget) viewer.current?.close();
          }}
        >
          <button
            className="button secondary"
            type="button"
            onClick={() => viewer.current?.close()}
          >
            Close image
          </button>
          {/* The same authorized public preview is used at its natural dimensions. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={product.title} />
        </dialog>
      )}
    </article>
  );
}
