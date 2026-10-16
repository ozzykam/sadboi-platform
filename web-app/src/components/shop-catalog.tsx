"use client";
/* eslint-disable @next/next/no-img-element */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { restoreStoreCart, usShippingRegions, type StoreOrderInput, type ShippingSettings, type CheckoutTotals } from "@sadboi/core";
import type { checkoutQuote } from "@/server/checkout-quote";
import { inventoryRequest } from "@/lib/inventory-client";
import { CheckoutTotalSummary } from "./checkout-totals";
import {
  pendingCheckout,
  savePendingCheckout,
  submitCheckout,
  checkoutWasRejected,
  type CheckoutAttempt,
} from "@/lib/store-checkout-client";
import { CatalogImage } from "./catalog-image";
import Link from "next/link";
import { ShopProductDetail } from "./shop-product-detail";
import type { PublicCollection } from "@sadboi/core";
import { ShopIntro } from "./catalog-skeletons";
import { ArrowLeft, Eye, ShoppingBag } from "lucide-react";
import type { PublicCatalogItem } from "@/server/public-catalog";
import { StoreOrderForm, type StoreCartLine } from "./store-order-form";
import { Button, Input } from "./ui";

export function ShopCatalog({ products, shipping, detailProduct, collection, collections = [] }: { products: PublicCatalogItem[]; shipping: ShippingSettings; detailProduct?: PublicCatalogItem; collection?: PublicCollection; collections?: Array<Pick<PublicCollection, "id" | "title">> }) {
  // Keep the full public catalog for cart restoration; only browsing is scoped.
  const browseProducts = useMemo(() => collection ? collection.productIds.flatMap(id => { const product=products.find(item => item.id===id); return product ? [product] : []; }) : products, [collection,products]);
  const [shippingService, setShippingService] = useState<"standard" | "express">(shipping.input.standard.enabled ? "standard" : "express");
  const [review, setReview] = useState<{ input: StoreOrderInput; quote: Awaited<ReturnType<typeof checkoutQuote>> } | null>(null);
  const categories = useMemo(
    () => [
      "All",
      ...Array.from(new Set(browseProducts.map((product) => product.kind))).sort(),
    ],
    [browseProducts],
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
    id: string;
    managementToken?: string;
    expiresAt?: string;
    orderNumber: string;
    totalMinor: number;
    pricing?: CheckoutTotals;
  } | null>(null);
  const [checkoutMethod, setCheckoutMethod] = useState<"pickup" | "shipping">(
    "pickup",
  );
  const filtered =
    category === "All"
      ? browseProducts
      : browseProducts.filter((product) => product.kind === category);
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
        if (
          attempt ||
          new URLSearchParams(window.location.search).get("cart") === "open"
        )
          setCartOpen(true);
        setCartReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [products]);
  useEffect(() => {
    const openCart = () => setCartOpen(true);
    window.addEventListener("sadboi-open-cart", openCart);
    return () => window.removeEventListener("sadboi-open-cart", openCart);
  }, []);
  useEffect(() => {
    if (!cartReady) return;
    try {
      window.localStorage.setItem("sadboi-shop-cart", JSON.stringify(cart));
      window.dispatchEvent(new Event("sadboi-cart-updated"));
    } catch {
      /* Keep the cart usable when storage is blocked or full. */
    }
  }, [cart, cartReady]);
  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.defaultPrevented || document.querySelector("dialog[open]")) return;
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
    setReview(null);
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
  async function sendCheckout(input?: StoreOrderInput, quoteId?: string) {
    if (checkoutLock.current || !cartReady || (!pending && !input)) return;
    checkoutLock.current = true;
    setCheckoutBusy(true);
    setCheckoutMessage("");
    const attempt = pending ?? {
      operationId: crypto.randomUUID(),
      input: input!,
      quoteId,
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
        setReview(null);
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
    const input: StoreOrderInput = {
      customerName: String(data.get("customerName") ?? ""),
      customerEmail: String(data.get("customerEmail") ?? ""),
      notes: String(data.get("notes") ?? ""),
      fulfillmentMethod: checkoutMethod,
      ...(checkoutMethod === "shipping" ? { shippingService } : {}),
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
    };
    if (review && JSON.stringify(review.input) === JSON.stringify(input)) { await sendCheckout(input, review.quote.id); return; }
    if (checkoutLock.current || !cartReady) return;
    checkoutLock.current = true; setCheckoutBusy(true); setCheckoutMessage("");
    try { const quote = await inventoryRequest("/api/store/quote", { method: "POST", body: JSON.stringify(input) }); setReview({ input, quote }); }
    catch (error) { setReview(null); setCheckoutMessage(error instanceof Error ? error.message : "The total could not be checked. Try again."); }
    finally { checkoutLock.current = false; setCheckoutBusy(false); }
  }
  return (
    <>
      {detailProduct ? (
        <ShopProductDetail
          product={detailProduct}
          onAddToCart={addToCart}
          onViewCart={() => setCartOpen(true)}
          disabled={!cartReady || !!pending || checkoutBusy}
          pending={!!pending}
        />
      ) : collection ? <header className="shop-collection-intro"><Link href="/shop" className="shop-product-back">← All products</Link><p className="eyebrow">SADBOI / COLLECTION</p><h1>{collection.title}</h1><p className="preserve-lines">{collection.description}</p></header> : <ShopIntro />}
      <section className="shop-section" id="shop-products">
        <div className="shop-catalog-layout">
          {!detailProduct && <>
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
                      ? browseProducts.length
                      : browseProducts.filter((product) => product.kind === item)
                          .length}
                  </small>
                </button>
              ))}
            </nav>
            {!!collections.length && <nav className="shop-collection-links" aria-label="Shop collections"><p className="shop-sidebar-label">Collections</p>{collections.map(item=><Link key={item.id} href={`/shop/collections/${item.id}`} aria-current={collection?.id===item.id ? "page" : undefined}>{item.title}</Link>)}</nav>}
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
                  <article
                    className="shop-product"
                    id={`product-${product.id}`}
                    key={product.id}
                  >
                    <button
                      type="button"
                      className={`shop-product-image art-${index % 4}`}
                      onClick={() => setSelected(product)}
                      aria-label={`View ${product.title}`}
                    >
                      {imageUrl ? (
                        <CatalogImage
                          variant="shop"
                          src={imageUrl}
                          alt=""
                          sizes="(max-width: 760px) 50vw, 25vw"
                        />
                      ) : (
                        <>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <b>{product.kind}</b>
                        </>
                      )}
                    </button>
                    <Link
                      href={`/shop/${product.id}`}
                      className="shop-product-meta shop-product-meta-button"
                    >
                      <div>
                        <h3>{product.title}</h3>
                        <p>
                          {product.variants.length}{" "}
                          {product.variants.length === 1 ? "option" : "options"}
                        </p>
                      </div>
                      <strong>From ${(lowest / 100).toFixed(2)}</strong>
                    </Link>
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
          </>}
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
                      <CatalogImage
                        variant="shop"
                        src={selectedImage}
                        alt={selected.title}
                        sizes="(max-width: 760px) 100vw, 45vw"
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
                    <Link className="inline-link" href={`/shop/${selected.id}`}>...view more</Link>
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
                        Your request is saved. Stock is held for 30 minutes while awaiting payment.
                    </p>
                      <CheckoutTotalSummary pricing={orderConfirmation.pricing} totalMinor={orderConfirmation.totalMinor} />
                      {orderConfirmation.managementToken && <a className="inline-link" href={`/orders/${orderConfirmation.id}#${orderConfirmation.managementToken}`}>View order and payment options</a>}
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
                          {((review?.quote.lines.find(item => item.variantId === line.variantId)?.priceMinor ?? line.priceMinor) / 100).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          disabled={!!pending || checkoutBusy}
                          onClick={() => {
                            setReview(null);
                            setCart((current) =>
                              current.filter(
                                (item) => item.variantId !== line.variantId,
                              ),
                            );
                          }}
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
                      <span>{review ? "Item subtotal" : "Estimated item subtotal"}</span>
                      <strong>${((review?.quote.totals.subtotalMinor ?? cartTotal) / 100).toFixed(2)}</strong>
                    </div>
                    <form className="shop-cart-checkout" onSubmit={checkout} onChange={() => setReview(null)}>
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
                            <option value="pickup">Studio pickup (free)</option>
                            <option value="shipping" disabled={!shipping.input.standard.enabled && !shipping.input.express.enabled}>Ship to me</option>
                          </select>
                        </label>
                        {checkoutMethod === "shipping" && (
                          <div className="shop-address-fields">
                            <label className="shop-checkout-select">Shipping service<select value={shippingService} onChange={event => setShippingService(event.target.value as "standard" | "express")}>
                              <option value="standard" disabled={!shipping.input.standard.enabled}>Standard shipping</option>
                              <option value="express" disabled={!shipping.input.express.enabled}>Express shipping</option>
                            </select></label>
                            {/* <p>Ships to: {shipping.input.regions.join(", ")}. Charges are per order; delivery dates are not guaranteed.</p> */}
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
                              <label className="shop-checkout-select">
                                State code
                                <select name="region" required defaultValue="" autoComplete="address-level1">
                                  <option value="" disabled>Select a state</option>
                                  {usShippingRegions.filter(region => shipping.input.regions.includes(region)).map(region => (
                                    <option key={region} value={region}>{region}</option>
                                  ))}
                                </select>
                              </label>
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
                        {!shipping.input.standard.enabled && !shipping.input.express.enabled && <p>Shipping is not available yet. Studio pickup is free.</p>}
                        {review && <div role="status"><h3>Review your test total</h3><CheckoutTotalSummary pricing={review.quote.totals} totalMinor={review.quote.totals.totalMinor} /><p>Current catalog prices and shipping charges are shown above. No real payment is collected. Requesting the order saves these amounts.</p></div>}
                        <Button
                          type="submit"
                          loading={checkoutBusy}
                          disabled={!cartReady}
                        >
                          {review ? "Request order" : "Review total"}
                        </Button>
                      </fieldset>
                      <details className="shop-order-note">
                        <summary>How order requests work</summary>
                        <p>
                          Choose your quantities, open Cart, enter your name and
                          email, then choose Studio pickup or Ship to me and
                          enter a supported US address. Choose Review total to see current prices and shipping, then Request order to save a request
                          awaiting payment; it does not charge you.
                        </p>
                        <p>
                          For example, two $25 prints have a $50 item subtotal.
                          Shipping is added once per order at the configured rate; studio pickup is free. Tax is not calculated in test checkout. Stocked
                            items are held for 30 minutes when your request is saved. Adding
                          items to the cart alone does not hold them.
                        </p>
                        <p>
                          Use Remove before submitting to change your selection.
                          If a request needs confirmation, use Retry order
                          request to recover the same order. Keep this tab open
                          until you see its number. Contact the studio with that
                            number for changes afterward. Use the order link to check payment status or cancel an unpaid order.
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
