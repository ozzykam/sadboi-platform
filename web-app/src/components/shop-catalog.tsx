"use client";
/* eslint-disable @next/next/no-img-element */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { restoreStoreCart, type StoreOrderInput } from "@sadboi/core";
import {
  pendingCheckout,
  savePendingCheckout,
  submitCheckout,
  checkoutWasRejected,
  type CheckoutAttempt,
} from "@/lib/store-checkout-client";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Eye, House, ShoppingBag } from "lucide-react";
import type { PublicCatalogItem } from "@/server/public-catalog";
import { StoreOrderForm, type StoreCartLine } from "./store-order-form";
import { Button, Input } from "./ui";

export function ShopCatalog({ products }: { products: PublicCatalogItem[] }) {
  const categories = useMemo(
    () => [
      "All",
      ...Array.from(new Set(products.map((product) => product.kind))).sort(),
    ],
    [products],
  );
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<PublicCatalogItem | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [cart, setCart] = useState<StoreCartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [cartReady, setCartReady] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [pending, setPending] = useState<CheckoutAttempt | null>(null);
  const checkoutLock = useRef(false);
  const [orderConfirmation, setOrderConfirmation] = useState<{
    orderNumber: string;
    totalMinor: number;
  } | null>(null);
  const [checkoutMethod, setCheckoutMethod] = useState<"pickup" | "shipping">(
    "pickup",
  );
  const filtered =
    category === "All"
      ? products
      : products.filter((product) => product.kind === category);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("sadboi-shop-cart");
        if (stored) setCart(restoreStoreCart(JSON.parse(stored), products));
      } catch {
        // A blocked storage area or invalid saved cart must not break the shop.
      } finally {
        const attempt = pendingCheckout();
        setPending(attempt);
        if (attempt) setCartOpen(true);
        setCartReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [products]);
  useEffect(() => {
    if (!cartReady) return;
    try {
      window.localStorage.setItem("sadboi-shop-cart", JSON.stringify(cart));
    } catch {
      /* Keep the cart usable when storage is blocked or full. */
    }
  }, [cart, cartReady]);
  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (zoomed) setZoomed(false);
      else setSelected(null);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [selected, zoomed]);
  const selectedImage =
    selected?.imageUrl ??
    selected?.variants.find((variant) => variant.imageUrl)?.imageUrl;
  function addToCart(lines: StoreCartLine[]) {
    if (pending || checkoutLock.current || !cartReady) return;
    setOrderConfirmation(null);
    setCheckoutMessage("");
    setCart((current) => restoreStoreCart([...current, ...lines], products));
  }
  function addAndCloseCart(lines: StoreCartLine[]) {
    addToCart(lines);
    setZoomed(false);
    setSelected(null);
  }
  const cartTotal = cart.reduce(
    (total, line) => total + line.priceMinor * line.quantity,
    0,
  );
  async function sendCheckout(input?: StoreOrderInput) {
    if (checkoutLock.current || !cartReady || (!pending && !input)) return;
    checkoutLock.current = true;
    setCheckoutBusy(true);
    setCheckoutMessage("");
    const attempt = pending ?? {
      operationId: crypto.randomUUID(),
      input: input!,
    };
    setPending(attempt);
    savePendingCheckout(attempt);
    try {
      const result = await submitCheckout(attempt);
      savePendingCheckout(null);
      setPending(null);
      setOrderConfirmation(result);
      setCart([]);
    } catch (error) {
      if (checkoutWasRejected(error)) {
        savePendingCheckout(null);
        setPending(null);
      }
      setCheckoutMessage(
        error instanceof Error ? error.message : "Could not create order.",
      );
    } finally {
      checkoutLock.current = false;
      setCheckoutBusy(false);
    }
  }
  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await sendCheckout({
      customerName: String(data.get("customerName") ?? ""),
      customerEmail: String(data.get("customerEmail") ?? ""),
      notes: String(data.get("notes") ?? ""),
      fulfillmentMethod: checkoutMethod,
      shippingAddress:
        checkoutMethod === "shipping"
          ? {
              line1: String(data.get("line1") ?? ""),
              line2: String(data.get("line2") ?? ""),
              city: String(data.get("city") ?? ""),
              region: String(data.get("region") ?? ""),
              postalCode: String(data.get("postalCode") ?? ""),
              country: "US",
            }
          : null,
      lines: cart.map(({ variantId, quantity }) => ({
        variantId,
        quantity,
      })),
    });
  }
  return (
    <>
      <header className="shop-header">
        <Link href="/" className="shop-logo">
          sadboi<span>/ studio</span>
        </Link>
        <nav>
          <a href="#shop-products">Shop</a>
          <a href="#shop-categories">Categories</a>
        </nav>
        <div className="shop-header-actions">
          <button
            type="button"
            className="shop-cart-button"
            onClick={() => setCartOpen(true)}
          >
            Cart{" "}
            <span>
              {cart.reduce((total, line) => total + line.quantity, 0)}
            </span>
          </button>
          <Link className="shop-back" href="/">
            Studio home <House size={14} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <section className="shop-hero shop-hero-compact">
        <p className="eyebrow">SADBOI / SHOP</p>
        <h1>
          Made in small
          <br />
          <em>editions.</em>
        </h1>
        <p>
          Objects, prints, and pieces from the studio. Browse the catalog by
          category.
        </p>
      </section>
      <section className="shop-section" id="shop-products">
        <div className="shop-catalog-layout">
          <aside
            className="shop-sidebar"
            id="shop-categories"
            aria-label="Product categories"
          >
            <p className="shop-sidebar-label">Browse</p>
            <nav className="shop-category-list">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === category ? "is-active" : ""}
                  onClick={() => setCategory(item)}
                >
                  <span className="capitalize">{item}</span>
                  <small>
                    {item === "All"
                      ? products.length
                      : products.filter((product) => product.kind === item)
                          .length}
                  </small>
                </button>
              ))}
            </nav>
          </aside>
          <section className="shop-products" aria-live="polite">
            <div className="shop-products-heading">
              <div>
                <p className="eyebrow">Shop / {category}</p>
                <h2>{category === "All" ? "All products" : category}</h2>
              </div>

              <span>
                {filtered.length}{" "}
                {filtered.length === 1 ? "product" : "products"}
              </span>
            </div>
            {!filtered.length && (
              <p className="shop-empty">
                Nothing is published in this category yet.
              </p>
            )}
            <div className="shop-product-grid">
              {filtered.map((product, index) => {
                const prices = product.variants.map(
                  (variant) => variant.priceMinor,
                );
                const lowest = prices.length ? Math.min(...prices) : 0;
                const imageUrl =
                  product.imageUrl ??
                  product.variants.find((variant) => variant.imageUrl)
                    ?.imageUrl;
                return (
                  <article className="shop-product" key={product.id}>
                    <button
                      type="button"
                      className={`shop-product-image art-${index % 4}`}
                      onClick={() => setSelected(product)}
                      aria-label={`View ${product.title}`}
                    >
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt=""
                          fill
                          sizes="(max-width: 760px) 50vw, 25vw"
                          className="shop-product-photo"
                          unoptimized
                        />
                      ) : (
                        <>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <b>{product.kind}</b>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="shop-product-meta shop-product-meta-button"
                      onClick={() => setSelected(product)}
                    >
                      <div>
                        <h3>{product.title}</h3>
                        <p>
                          {product.variants.length}{" "}
                          {product.variants.length === 1 ? "option" : "options"}
                        </p>
                      </div>
                      <strong>From ${(lowest / 100).toFixed(2)}</strong>
                    </button>
                    <button
                      type="button"
                      className="shop-product-view"
                      onClick={() => setSelected(product)}
                    >
                      <span>View Details</span>
                      <Eye size={18} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
          {selected && (
            <div
              className="shop-dialog-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) setSelected(null);
              }}
            >
              <section
                className="shop-dialog"
                style={
                  {
                    "--shop-dialog-start": selected.gradientStart ?? "#312b30",
                    "--shop-dialog-end": selected.gradientEnd ?? "#9f596a",
                  } as CSSProperties
                }
                role="dialog"
                aria-modal="true"
                aria-labelledby="shop-dialog-title"
              >
                <button
                  type="button"
                  className="shop-dialog-close"
                  onClick={() => setSelected(null)}
                  aria-label="Close product details"
                >
                  ×
                </button>
                <div className="shop-dialog-image">
                  {selectedImage ? (
                    <button
                      type="button"
                      className="shop-dialog-image-button"
                      onClick={() => setZoomed(true)}
                      aria-label={`View ${selected.title} full size`}
                    >
                      <Image
                        src={selectedImage}
                        alt={selected.title}
                        fill
                        sizes="(max-width: 760px) 100vw, 45vw"
                        className="shop-product-photo"
                        unoptimized
                      />
                    </button>
                  ) : (
                    <span>{selected.kind}</span>
                  )}
                </div>
                <div className="shop-dialog-content">
                  <div className="shop-dialog-title-header">
                    <p className="eyebrow">{selected.kind}</p>
                    <h2 id="shop-dialog-title">{selected.title}</h2>
                  </div>
                  <div className="shop-dialog-description">
                    {(
                      selected.description ||
                      "A studio edition from the Sadboi catalog."
                    )
                      .split(/\n\s*\n/)
                      .map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                  </div>
                  <p className="shop-dialog-label shop-dialog-variation-label">
                    Available variations · choose quantity
                  </p>
                  <StoreOrderForm
                    product={selected}
                    onAddToCart={addAndCloseCart}
                    disabled={!cartReady || !!pending || checkoutBusy}
                  />
                </div>
              </section>
            </div>
          )}
          {cartOpen && (
            <div
              className="shop-cart-backdrop"
              role="presentation"
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) setCartOpen(false);
              }}
            >
              <aside
                className="shop-cart-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cart-title"
              >
                <button
                  type="button"
                  className="shop-dialog-close"
                  onClick={() => setCartOpen(false)}
                  aria-label="Close cart"
                >
                  ×
                </button>
                <p className="eyebrow">YOUR CART</p>
                <h2 id="cart-title">Ready when you are.</h2>
                {pending && (
                  <div className="notice" role="status">
                    <p>
                      {checkoutBusy
                        ? "Saving your order request…"
                        : "Your last request still needs confirmation. Retry it to recover the order number before changing your cart."}
                    </p>
                    <Button
                      type="button"
                      loading={checkoutBusy}
                      onClick={() => void sendCheckout()}
                    >
                      Retry order request
                    </Button>
                  </div>
                )}
                {!cartReady && <p role="status">Loading your cart…</p>}
                {orderConfirmation && (
                  <div className="shop-order-confirmation">
                    <span className="shop-confirmation-mark">✓</span>
                    <p className="eyebrow">ORDER RECEIVED</p>
                    <h3>{orderConfirmation.orderNumber}</h3>
                    <p>
                      Your request is saved. We’ll follow up with payment
                      confirmation and fulfillment details.
                    </p>
                    <strong>
                      ${(orderConfirmation.totalMinor / 100).toFixed(2)}
                    </strong>
                    <button
                      type="button"
                      onClick={() => {
                        setOrderConfirmation(null);
                        setCartOpen(false);
                      }}
                    >
                      Keep browsing
                    </button>
                  </div>
                )}
                {cartReady &&
                  !pending &&
                  !orderConfirmation &&
                  !cart.length &&
                  !checkoutMessage && (
                    <div className="shop-cart-empty">
                      <ShoppingBag
                        size={42}
                        strokeWidth={1.2}
                        aria-hidden="true"
                      />
                      <h3>Your collection starts here.</h3>
                      <p>
                        Find a piece that feels like yours and it will wait
                        here.
                      </p>
                      <button type="button" onClick={() => setCartOpen(false)}>
                        Keep browsing{" "}
                        <ArrowLeft
                          size={15}
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  )}
                {!orderConfirmation && cart.length > 0 && (
                  <div className="shop-cart-lines">
                    {cart.map((line) => (
                      <div className="shop-cart-line" key={line.variantId}>
                        <div>
                          <strong>{line.productTitle}</strong>
                          <small>{line.variantName}</small>
                        </div>
                        <span>
                          {line.quantity} × $
                          {(line.priceMinor / 100).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          disabled={!!pending || checkoutBusy}
                          onClick={() =>
                            setCart((current) =>
                              current.filter(
                                (item) => item.variantId !== line.variantId,
                              ),
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {!orderConfirmation && cart.length > 0 && (
                  <>
                    <div className="shop-cart-total">
                      <span>Subtotal</span>
                      <strong>${(cartTotal / 100).toFixed(2)}</strong>
                    </div>
                    <form className="shop-cart-checkout" onSubmit={checkout}>
                      <fieldset
                        disabled={!!pending || checkoutBusy}
                        style={{ display: "contents" }}
                      >
                        <Input
                          label="Your Name"
                          name="customerName"
                          required
                          maxLength={160}
                        />
                        <Input
                          label="Email"
                          name="customerEmail"
                          type="email"
                          required
                          maxLength={254}
                        />
                        <label className="shop-checkout-select">
                          Fulfillment
                          <select
                            name="fulfillmentMethod"
                            value={checkoutMethod}
                            onChange={(event) =>
                              setCheckoutMethod(
                                event.target.value as "pickup" | "shipping",
                              )
                            }
                          >
                            <option value="pickup">Studio pickup</option>
                            <option value="shipping">Ship to me</option>
                          </select>
                        </label>
                        {checkoutMethod === "shipping" && (
                          <div className="shop-address-fields">
                            <Input
                              label="Address"
                              name="line1"
                              required
                              maxLength={180}
                            />
                            <Input
                              label="Apartment / suite (optional)"
                              name="line2"
                              maxLength={180}
                            />
                            <Input
                              label="City"
                              name="city"
                              required
                              maxLength={100}
                            />
                            <Input
                              label="State / region"
                              name="region"
                              required
                              maxLength={100}
                            />
                            <Input
                              label="Postal code"
                              name="postalCode"
                              required
                              maxLength={24}
                            />
                          </div>
                        )}
                        <Input
                          label="Note (optional)"
                          name="notes"
                          maxLength={2000}
                        />
                        <Button
                          type="submit"
                          loading={checkoutBusy}
                          disabled={!cartReady}
                        >
                          Request order
                        </Button>
                      </fieldset>
                      <details className="shop-order-note">
                        <summary>How order requests work</summary>
                        <p>
                          Choose your quantities, open Cart, enter your name and
                          email, then choose Studio pickup or Ship to me and
                          enter a US address. Request order saves a request
                          awaiting payment; it does not charge you.
                        </p>
                        <p>
                          For example, two $25 prints have a $50 item subtotal.
                          Shipping and tax are not calculated here. Stocked
                          items are held when your request is saved. Adding
                          items to the cart alone does not hold them.
                        </p>
                        <p>
                          Use Remove before submitting to change your selection.
                          If a request needs confirmation, use Retry order
                          request to recover the same order. Keep this tab open
                          until you see its number. Contact the studio with that
                          number for changes afterward; payment and fulfillment
                          are arranged separately.
                        </p>
                      </details>
                    </form>
                  </>
                )}
                {checkoutMessage && (
                  <p className="notice" role="status">
                    {checkoutMessage}
                  </p>
                )}
              </aside>
            </div>
          )}
          {zoomed && selectedImage && (
            <div
              className="shop-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label={`${selected?.title ?? "Product"} full-size image`}
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) setZoomed(false);
              }}
            >
              <button
                type="button"
                className="shop-lightbox-close"
                onClick={() => setZoomed(false)}
                aria-label="Close full-size image"
              >
                ×
              </button>
              <img
                src={selectedImage}
                alt={selected?.title ?? "Product"}
                className="shop-lightbox-image"
              />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
