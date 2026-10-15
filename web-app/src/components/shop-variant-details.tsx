"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import type { PublicCatalogItem } from "@/server/public-catalog";
import { CatalogImage } from "./catalog-image";
type Variation = PublicCatalogItem["variants"][number];

export function ShopVariantDetails({
  variant,
  product,
}: {
  variant: Variation;
  product: PublicCatalogItem;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [index, setIndex] = useState(0);
  const images = variant.imageUrls?.length
    ? variant.imageUrls
    : variant.imageUrl
      ? [variant.imageUrl]
      : product.imageUrl
        ? [product.imageUrl]
        : [];
  const move = (direction: number) =>
    setIndex(
      (current) => (current + direction + images.length) % images.length,
    );
  const specs = [
    ["Size", variant.size],
    ["Color", variant.color],
    ["Material", variant.material],
    ["Finish", variant.finish],
  ].filter(([, value]) => value);
  return (
    <>
      <button
        type="button"
        className="shop-variation-info shop-variation-trigger"
        aria-label={`View ${variant.name} details`}
        aria-haspopup="dialog"
        onClick={() => {
          setIndex(0);
          dialog.current?.showModal();
        }}
      >
        <strong>${(variant.priceMinor / 100).toFixed(2)}</strong>
        <span>
          {variant.name}
          <small>
            {[variant.size, variant.color, variant.material, variant.finish]
              .filter(Boolean)
              .join(" · ") || "Standard"}
          </small>
          <small className="shop-variation-view">
            <Eye size={14} aria-hidden="true" /> View details &amp; images
          </small>
        </span>
      </button>
      <dialog
        ref={dialog}
        className="shop-variant-dialog"
        aria-label={`${variant.name} details`}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        onKeyDown={(event) => {
          // Keep Escape scoped to this dialog, leaving the product quick view open.
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            dialog.current?.close();
            return;
          }
          if (
            images.length > 1 &&
            ["ArrowLeft", "ArrowRight"].includes(event.key)
          ) {
            event.preventDefault();
            move(event.key === "ArrowRight" ? 1 : -1);
          }
        }}
      >
        <div className="shop-variant-heading">
          <p className="eyebrow">{product.title} / Variation</p>
          <button
            type="button"
            className="shop-variant-close"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} aria-hidden="true" /> Close
          </button>
        </div>
        <div className="shop-variant-layout">
          <section
            className="shop-variant-gallery"
            aria-label={`${variant.name} images`}
          >
            {images.length ? (
              <>
                <div
                  className="shop-variant-image"
                  onTouchStart={(event) => {
                    const point = event.touches[0];
                    touch.current = { x: point.clientX, y: point.clientY };
                  }}
                  onTouchEnd={(event) => {
                    const point = event.changedTouches[0],
                      start = touch.current;
                    touch.current = null;
                    if (
                      start &&
                      images.length > 1 &&
                      Math.abs(point.clientX - start.x) > 50 &&
                      Math.abs(point.clientX - start.x) >
                        Math.abs(point.clientY - start.y)
                    )
                      move(point.clientX < start.x ? 1 : -1);
                  }}
                >
                <CatalogImage
                  variant="shop"
                  sizes="(max-width: 680px) 90vw, 480px"
                    key={images[index]}
                    src={images[index]}
                    alt={`${variant.name}, image ${index + 1} of ${images.length}`}
                  />
                </div>
                {images.length > 1 && (
                  <>
                    <div className="shop-variant-carousel-controls">
                      <button
                        type="button"
                        aria-label="Previous variation image"
                        onClick={() => move(-1)}
                      >
                        <ChevronLeft aria-hidden="true" />
                      </button>
                      <span role="status" aria-live="polite">
                        Image {index + 1} of {images.length}
                      </span>
                      <button
                        type="button"
                        aria-label="Next variation image"
                        onClick={() => move(1)}
                      >
                        <ChevronRight aria-hidden="true" />
                      </button>
                    </div>
                    <div
                      className="shop-variant-thumbnails"
                      aria-label="Choose variation image"
                    >
                      {images.map((src, number) => (
                        <button
                          key={src}
                          type="button"
                          aria-label={`Show variation image ${number + 1}`}
                          aria-pressed={number === index}
                          onClick={() => setIndex(number)}
                        >
                          <img src={src} alt="" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="shop-product-image-empty">Images coming soon</p>
            )}
          </section>
          <section className="shop-variant-copy">
            <h2>{variant.name}</h2>
            <p className="shop-variant-price">
              ${(variant.priceMinor / 100).toFixed(2)} <small>USD</small>
            </p>
            <p className="preserve-lines">
              {variant.description ||
                "No additional description for this variation yet."}
            </p>
            {!!specs.length && (
              <dl>
                {specs.map(([name, value]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p>
              {variant.fulfillment === "made_to_order"
                ? "Made to order"
                : `${variant.available} available`}
            </p>
            <p className="shop-order-note">
              Close this view to choose a quantity and add this variation to
              your cart.
            </p>
          </section>
        </div>
      </dialog>
    </>
  );
}
