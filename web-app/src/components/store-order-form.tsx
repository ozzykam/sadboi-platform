"use client";
import { useState } from "react";
import type { PublicCatalogItem } from "@/server/public-catalog";
import type { StoreCartLine } from "@sadboi/core";
export type { StoreCartLine } from "@sadboi/core";
import { Button } from "./ui";
export function StoreOrderForm({
  product,
  onAddToCart,
  disabled = false,
}: {
  product: PublicCatalogItem;
  onAddToCart: (lines: StoreCartLine[]) => void;
  disabled?: boolean;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({}),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const lines = product.variants
      .map((v) => ({
        variantId: v.id,
        quantity: quantities[v.id] ?? 0,
        variantName: v.name,
        productTitle: product.title,
        priceMinor: v.priceMinor,
      }))
      .filter((v) => v.quantity > 0);
    if (!lines.length) {
      setError("Choose at least one edition.");
      return;
    }
    setError("");
    onAddToCart(lines);
    setMessage("Added to cart.");
    setQuantities({});
  }
  return (
    <form className="shop-order-form" onSubmit={submit}>
      <div className="shop-order-title">
        <span>Build your order</span>
        <small>Quantities</small>
      </div>
      <div className="shop-quantity-list">
        {product.variants.map((v) => (
          <div className="shop-quantity-row" key={v.id}>
            <div className="shop-variation-info">
              <strong>${(v.priceMinor / 100).toFixed(2)}</strong>
              <span>
                {v.name}
                <small>
                  {[v.size, v.color, v.material, v.finish]
                    .filter(Boolean)
                    .join(" · ") || "Standard"}
                </small>
              </span>
            </div>
            <div className="shop-stepper-column">
              <small className="shop-availability">
                {v.fulfillment === "made_to_order"
                  ? "Made to order"
                  : `${v.available} available`}
              </small>
              <div className="shop-stepper" aria-label={`${v.name} quantity`}>
                <button
                  type="button"
                  aria-label={`Decrease ${v.name} quantity`}
                  disabled={disabled || !quantities[v.id]}
                  onClick={() =>
                    setQuantities((current) => ({
                      ...current,
                      [v.id]: Math.max(0, (current[v.id] ?? 0) - 1),
                    }))
                  }
                >
                  −
                </button>
                <input
                  aria-label={`${v.name} quantity`}
                  type="number"
                  disabled={disabled}
                  min={0}
                  max={
                    v.fulfillment === "made_to_order"
                      ? 1000
                      : Math.min(1000, v.available)
                  }
                  value={quantities[v.id] ?? 0}
                  onChange={(e) => {
                    const max =
                      v.fulfillment === "made_to_order"
                        ? 1000
                        : Math.min(1000, v.available);
                    const next = Number(e.target.value);
                    setQuantities((current) => ({
                      ...current,
                      [v.id]: Number.isFinite(next)
                        ? Math.min(max, Math.max(0, Math.floor(next)))
                        : 0,
                    }));
                  }}
                />
                <button
                  type="button"
                  aria-label={`Increase ${v.name} quantity`}
                  disabled={
                    disabled ||
                    (quantities[v.id] ?? 0) >=
                      (v.fulfillment === "made_to_order"
                        ? 1000
                        : Math.min(1000, v.available))
                  }
                  onClick={() =>
                    setQuantities((current) => ({
                      ...current,
                      [v.id]: Math.min(
                        v.fulfillment === "made_to_order"
                          ? 1000
                          : Math.min(1000, v.available),
                        (current[v.id] ?? 0) + 1,
                      ),
                    }))
                  }
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <Button type="submit" disabled={disabled}>
        Add selected to cart
      </Button>
      <small className="shop-order-note">
        Payment confirmation will be arranged after the order is reviewed.
      </small>
    </form>
  );
}
