"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { VariantImages } from "./variant-images";
import { Lightbulb } from "lucide-react";
import { InventoryProductCards } from "./inventory-product-cards";
import {
  parseUsd,
  type InventoryCatalog,
  type ProductRecord,
  type StockVariantRecord,
  type StockLocationRecord,
  type ArtworkPage,
} from "@sadboi/core";
import { inventoryRequest } from "@/lib/inventory-client";
import { Button, Badge, PageHeading } from "./ui";
import {
  InventoryForm,
  Input,
  Textarea,
  Select,
  Status,
  value,
} from "./inventory-form";
import { InventoryStockPanel } from "./inventory-stock";
import { ReplenishmentPanel } from "./inventory-planning";
import { InventoryReservations } from "./inventory-reservations";
type Editing = {
  resource: "products" | "variants" | "locations";
  id: string;
  productId?: string;
};
function ImageUpload({
  resource,
  id,
  imageAssetId,
  onUploadingChange,
}: {
  resource: "products" | "variants";
  id?: string;
  imageAssetId?: string;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [savedAssetId, setSavedAssetId] = useState(imageAssetId);
  async function upload(file: File) {
    if (!id) return;
    setBusy(true);
    onUploadingChange(true);
    setMessage("");
    setError("");
    try {
      const proof = await fetch("/api/auth/csrf", { cache: "no-store" });
      const token = (await proof.json()).token;
      const response = await fetch(`/api/inventory/images/${resource}/${id}`, {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type, "X-CSRF-Token": token },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Upload failed.");
      setSavedAssetId(data.image.assetId);
      setMessage("Image saved. Save below applies your other product or variant changes.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      onUploadingChange(false);
    }
  }
  return (
    <div className="field inv-image-upload">
      <label htmlFor={`${resource}-image`}>Shop image</label>
      {id ? (
        <>
          <input
            id={`${resource}-image`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
          <p className="field-hint">
            Choose a JPEG, PNG, or WebP up to 12 MB. Selecting a file uploads
            and saves the shop image immediately.
          </p>
          {savedAssetId && (
            <Image
              src={`/api/inventory/images/${resource}/${id}?v=${encodeURIComponent(savedAssetId)}`}
              alt="Saved shop image"
              width={160}
              height={160}
              unoptimized
              style={{ objectFit: "contain", maxWidth: "100%" }}
            />
          )}
          {busy && <p role="status">Uploading image… Please wait before saving.</p>}
          {error && <p className="notice error" role="alert">{error}</p>}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
        </>
      ) : (
        <p className="field-hint">
          Save this {resource === "products" ? "product" : "variant"} first,
          then upload its shop image here.
        </p>
      )}
    </div>
  );
}
function ArtworkChoice() {
  const [page, setPage] = useState<ArtworkPage | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    inventoryRequest("/api/artworks")
      .then((data) => {
        if (active) setPage(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function more() {
    setBusy(true);
    setError("");
    try {
      const data: ArtworkPage = await inventoryRequest(
        "/api/artworks" +
          (page?.nextCursor ? "?cursor=" + page.nextCursor : ""),
      );
      setPage((current) => ({
        artworks: [...(current?.artworks ?? []), ...data.artworks],
        nextCursor: data.nextCursor,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load artwork.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="inv-wide">
      <Select
        label="Original artwork"
        name="artworkId"
        required
        defaultValue=""
      >
        <option value="">
          {page ? "Choose artwork" : "Loading artwork..."}
        </option>
        {page?.artworks.map((art) => (
          <option key={art.id} value={art.id}>
            {art.title} ({art.year})
          </option>
        ))}
      </Select>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {(error || page?.nextCursor) && (
        <Button variant="secondary" disabled={busy} onClick={more}>
          {busy ? "Loading..." : error ? "Retry artwork" : "Load more artwork"}
        </Button>
      )}
      {page && !page.artworks.length && (
        <p className="field-hint">
          Start by{" "}
          <Link href="/admin/artworks/new" className="inline-link">
            adding an artwork
          </Link>
          .
        </p>
      )}
    </div>
  );
}
function ProductFields({ record, onUploadingChange }: { record?: ProductRecord; onUploadingChange: (uploading: boolean) => void }) {
  return (
    <>
      <p className="field-hint inv-wide">
        A product is the item you offer, such as an art print or a T-shirt.
        After saving, add its sizes or styles as variants.
      </p>
      {!record && <ArtworkChoice />}
      <Input
        label="Product title"
        name="title"
        required
        maxLength={160}
        defaultValue={record?.title}
        placeholder="Midnight Garden â€” Art Print"
      />
      <Select
        label="Category"
        name="kind"
        defaultValue={record?.kind ?? "print"}
      >
        <option value="print">Print</option>
        <option value="apparel">Apparel</option>
        <option value="accessory">Accessory</option>
        <option value="playing_card">Playing Card</option>
        <option value="other">Other</option>
      </Select>
      <Textarea
        label="Description"
        name="description"
        maxLength={3000}
        rows={8}
        defaultValue={record?.description}
        placeholder="Describe the piece, materials, story, and what makes this edition distinct."
        helperText="Use a blank line between paragraphs."
      />
      {record && (
        <ImageUpload
          resource="products"
          id={record.id}
          imageAssetId={record.imageAssetId}
          onUploadingChange={onUploadingChange}
        />
      )}
      <div className="inv-color-fields">
        <Input
          label="Dialog gradient start"
          name="gradientStart"
          type="color"
          defaultValue={record?.gradientStart ?? "#312b30"}
        />
        <Input
          label="Dialog gradient end"
          name="gradientEnd"
          type="color"
          defaultValue={record?.gradientEnd ?? "#9f596a"}
        />
      </div>
      <Status initial={record?.status} />
      <Select
        label="Publication"
        name="publication"
        defaultValue={record?.publication ?? "private"}
      >
        <option value="private">Private</option>
        <option value="public">Public catalog</option>
      </Select>
    </>
  );
}
function VariantFields({
  record,
  productId,
  catalog,
  onUploadingChange,
  onImagesChange,
}: {
  record?: StockVariantRecord;
  productId?: string;
  catalog: InventoryCatalog;
  onUploadingChange: (uploading: boolean) => void;
  onImagesChange: (assetIds: string[]) => void;
}) {
  return (
    <>
      <p className="field-hint inv-wide">
        Each version with its own price or stock count needs a variant and a
        unique SKU. Keep related sizes, colors, frames, and finishes under the
        same product; each combination gets its own variant. Add one variant
        even if the product has only one size or style.
      </p>
      {!record && (
        <Select
          label="Product"
          name="productId"
          required
          defaultValue={productId ?? ""}
        >
          <option value="">Choose product</option>
          {catalog.products
            .filter((p) => p.status === "active")
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
        </Select>
      )}
      <Input
        label="SKU"
        name="sku"
        required
        maxLength={60}
        defaultValue={record?.sku}
        readOnly={!!record}
        helperText="A unique permanent code, such as SB-PRINT-001-A3."
      />
      <Input
        label="Variant name"
        name="name"
        required
        maxLength={160}
        defaultValue={record?.name}
        placeholder="A3 archival print"
      />
      <Textarea
        label="Variation description"
        name="description"
        rows={5}
        maxLength={3000}
        defaultValue={record?.description ?? ""}
        helperText="Shown when a shopper opens this variation. Describe its design, materials, dimensions, or what makes it different."
      />
      <Input
        label="Size"
        name="size"
        maxLength={100}
        defaultValue={record?.size}
      />
      <Input
        label="Color"
        name="color"
        maxLength={80}
        defaultValue={record?.color}
      />
      <Input
        label="Material"
        name="material"
        maxLength={160}
        defaultValue={record?.material}
      />
      <Input
        label="Finish"
        name="finish"
        maxLength={160}
        defaultValue={record?.finish}
      />
      <Input
        label="Retail price (USD)"
        name="price"
        inputMode="decimal"
        required
        defaultValue={record ? (record.priceMinor / 100).toFixed(2) : ""}
        placeholder="45.00"
      />
      <Input
        label="Weight (grams, optional)"
        name="weightGrams"
        type="number"
        min={1}
        max={1000000}
        step={1}
        defaultValue={record?.weightGrams ?? ""}
      />
      <Select
        label="Fulfillment"
        name="fulfillment"
        defaultValue={record?.fulfillment ?? "stocked"}
      >
        <option value="stocked">Stocked</option>
        <option value="made_to_order">Made to order</option>
      </Select>
      {record && (
        <VariantImages
          id={record.id}
          initial={record.imageAssetIds ?? (record.imageAssetId ? [record.imageAssetId] : [])}
          onUploadingChange={onUploadingChange}
          onImagesChange={onImagesChange}
        />
      )}
      <Status initial={record?.status} />
      <Select
        label="Publication"
        name="publication"
        defaultValue={record?.publication ?? "private"}
      >
        <option value="private">Private</option>
        <option value="public">Public catalog</option>
      </Select>
    </>
  );
}
function LocationFields({ record }: { record?: StockLocationRecord }) {
  const [kind, setKind] = useState(record?.kind ?? "studio");
  return (
    <>
      <Input
        label="Location name"
        name="name"
        required
        maxLength={120}
        defaultValue={record?.name}
        placeholder="Studio shelves"
      />
      <Select
        label="Location type"
        name="kind"
        value={kind}
        onChange={(e) => setKind(e.target.value as StockLocationRecord["kind"])}
      >
        <option value="studio">Studio / fulfillment</option>
        <option value="gallery">Gallery</option>
        <option value="event">Event / convention</option>
        <option value="transit">Transit holding location</option>
      </Select>
      <Status initial={record?.status} />
      <label className="inv-check">
        <input
          type="checkbox"
          name="onlineEligible"
          defaultChecked={record?.onlineEligible ?? false}
          disabled={kind === "transit"}
        />
        Can fulfill website orders
      </label>
      <p className="field-hint inv-wide">
        Gallery and event stock stays separate from website fulfillment unless
        you enable it here. Locations must be empty with no pending transfers
        before archiving.
      </p>
    </>
  );
}
export function MetadataEditor({
  editing,
  catalog,
  onSaved,
  onClose,
  onVariantImagesChange,
}: {
  editing: Editing;
  catalog: InventoryCatalog;
  onSaved: (id: string) => Promise<void>;
  onClose: () => void;
  onVariantImagesChange: (id: string, assetIds: string[]) => void;
}) {
  const [imageUploading, setImageUploading] = useState(false);
  const product =
    editing.resource === "products"
      ? catalog.products.find((p) => p.id === editing.id)
      : undefined;
  const variant =
    editing.resource === "variants"
      ? catalog.variants.find((p) => p.id === editing.id)
      : undefined;
  const location =
    editing.resource === "locations"
      ? catalog.locations.find((p) => p.id === editing.id)
      : undefined;
  const record = product ?? variant ?? location;
  function prepare(data: FormData) {
    const status = value(data, "status");
    if (editing.resource === "products")
      return {
        artworkId: product?.artworkId ?? value(data, "artworkId"),
        title: value(data, "title"),
        kind: value(data, "kind"),
        description: value(data, "description"),
        gradientStart: value(data, "gradientStart"),
        gradientEnd: value(data, "gradientEnd"),
        status,
        publication: value(data, "publication"),
      };
    if (editing.resource === "variants")
      return {
        productId: variant?.productId ?? value(data, "productId"),
        sku: variant?.sku ?? value(data, "sku"),
        name: value(data, "name"),
        description: value(data, "description"),
        size: value(data, "size"),
        color: value(data, "color"),
        material: value(data, "material"),
        finish: value(data, "finish"),
        priceMinor: parseUsd(value(data, "price")),
        currency: "USD",
        weightGrams: value(data, "weightGrams")
          ? Number(value(data, "weightGrams"))
          : null,
        fulfillment: value(data, "fulfillment"),
        status,
        publication: value(data, "publication"),
      };
    return {
      name: value(data, "name"),
      kind: value(data, "kind"),
      onlineEligible: data.has("onlineEligible"),
      status,
    };
  }
  return (
    <section className="inv-panel">
      <div className="section-heading">
        <h2>
          {record ? "Edit" : "Add"}{" "}
          {editing.resource === "products"
            ? "product"
            : editing.resource === "variants"
              ? "variant"
              : "location"}
        </h2>
        <Button variant="ghost" onClick={onClose} disabled={imageUploading}>
          Close
        </Button>
      </div>
      <InventoryForm
        action={editing.resource}
        record={record}
        prepare={prepare}
        onSaved={onSaved}
        again={false}
        disabled={imageUploading}
      >
        {editing.resource === "products" ? (
          <ProductFields record={product} onUploadingChange={setImageUploading} />
        ) : editing.resource === "variants" ? (
          <VariantFields
            record={variant}
            productId={editing.productId}
            catalog={catalog}
            onUploadingChange={setImageUploading}
            onImagesChange={(assetIds) => onVariantImagesChange(editing.id, assetIds)}
          />
        ) : (
          <LocationFields record={location} />
        )}
      </InventoryForm>
    </section>
  );
}
export function SharedInventory({
  initial,
  canEdit,
  initialVariant,
}: {
  initial: InventoryCatalog;
  canEdit: boolean;
  initialVariant?: string;
}) {
  const [catalog, setCatalog] = useState(initial),
    [tab, setTab] = useState<
      "catalog" | "stock" | "locations" | "replenishment" | "reservations"
    >(initialVariant ? "stock" : "catalog");
  const [nextStep, setNextStep] = useState<{
    resource: Editing["resource"];
    id: string;
  } | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null),
    [selected, setSelected] = useState(initialVariant ?? initial.variants[0]?.id ?? "");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [stockVersion, setStockVersion] = useState(0);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setCatalog(await inventoryRequest("/api/inventory"));
      setStockVersion((n) => n + 1);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh inventory.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saved(id: string) {
    const previous = editing;
    if (previous?.resource === "variants") setSelected(id);
    setEditing(null);
    if ((await refresh()) && previous?.id === "new")
      setNextStep({ resource: previous.resource, id });
  }
  function edit(resource: Editing["resource"], id = "new", productId?: string) {
    setNextStep(null);
    setEditing({ resource, id, productId });
  }
  function viewStock(id: string) {
    setNextStep(null);
    setSelected(id);
    setTab("stock");
  }
  const products = catalog.products.filter((p) =>
    (
      p.title +
      " " +
      catalog.variants
        .filter((v) => v.productId === p.id)
        .map((v) => v.sku + " " + v.name)
        .join(" ")
    )
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="INVENTORY / STUDIO OPERATIONS"
        title="Art, Merch, & More"
        description="Products, physical stock, and every movement between the studio, galleries, and events."
        action={
          <Button variant="secondary" onClick={refresh} disabled={busy}>
            {busy ? "Refreshing..." : "Refresh inventory"}
          </Button>
        }
      />
      {!canEdit && (
        <p className="notice">
          Accounting access: view catalog, balances, receiving costs, and
          movement history.
        </p>
      )}
      <p className="howto-context">
        <Link className="inline-link howto-link" href="/admin/how-to#products">
          <Lightbulb size={14} /> Create or edit products &amp; variants
        </Link><br/>
        <Link className="inline-link howto-link" href="/admin/how-to#stock">
          <Lightbulb size={14} /> Set up or count stock
        </Link>
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error} Use Refresh inventory to load the latest saved records.
        </p>
      )}
      <nav className="inv-tabs" aria-label="Inventory sections">
        {(
          [
            "catalog",
            "stock",
            "locations",
            "replenishment",
            "reservations",
          ] as const
        ).map((section) => (
          <button
            className="button secondary"
            key={section}
            aria-pressed={tab === section}
            onClick={() => {
              setTab(section);
              setEditing(null);
              setNextStep(null);
            }}
          >
            {section === "catalog"
              ? "Products & variants"
              : section === "stock"
                ? "Stock & transfers"
                : section === "locations"
                  ? "Locations"
                  : section === "replenishment"
                    ? "Low stock"
                    : "Reservations"}
          </button>
        ))}
      </nav>
      {nextStep && (
        <div className="notice inv-next" role="status">
          <p>
            {nextStep.resource === "products"
              ? "Product saved. Next, add its first size or style as a variant."
              : nextStep.resource === "variants"
                ? "Variant saved. Next, choose a location and record its opening stock."
                : "Location saved. Open a variant to receive or count stock here."}
          </p>
          {nextStep.resource === "products" ? (
            <Button
              variant="secondary"
              onClick={() => edit("variants", "new", nextStep.id)}
            >
              Add first variant
            </Button>
          ) : nextStep.resource === "variants" ? (
            <Button variant="secondary" onClick={() => viewStock(nextStep.id)}>
              Record stock
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                setNextStep(null);
                setTab("stock");
              }}
            >
              Choose a variant
            </Button>
          )}
        </div>
      )}
      {editing ? (
        <MetadataEditor
          key={editing.resource + editing.id}
          editing={editing}
          catalog={catalog}
          onSaved={saved}
          onClose={() => setEditing(null)}
          onVariantImagesChange={(id, assetIds) => setCatalog((current) => ({
            ...current,
            variants: current.variants.map((variant) => variant.id === id
              ? { ...variant, imageAssetIds: assetIds, imageAssetId: assetIds[0] }
              : variant),
          }))}
        />
      ) : tab === "reservations" ? (
        <InventoryReservations inventory={catalog} canEdit={canEdit} />
      ) : tab === "catalog" ? (
        <section>
          <details className="inv-guide" open={!catalog.products.length}>
            <summary>How products, variants, and stock fit together</summary>
            <ol>
              <li>
                <strong>Artwork:</strong> the original creative work.{" "}
                {canEdit && (
                  <Link className="inline-link" href="/admin/artworks">
                    Open artwork library
                  </Link>
                )}
              </li>
              <li>
                <strong>Product:</strong> the item based on that art, such as
                â€œMidnight Garden â€” Art Print.â€
              </li>
              <li>
                <strong>Variant:</strong> the exact version, such as an A3 matte
                print. Each variant has its own permanent SKU, price, and stock.
              </li>
              <li>
                <strong>Location and stock:</strong> record how many units are
                physically at the studio, gallery, or event. Start with Receive
                accepted stock or Count physical stock.
              </li>
            </ol>
            <p>
              To retire a product, choose Edit product â†’ Status â†’ Archived.
              Its stock and history are preserved.
            </p>
          </details>
          <div className="inv-toolbar">
            <Input
              label="Search products or SKUs"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {canEdit && (
              <Button onClick={() => edit("products")}>Add product</Button>
            )}
          </div>
          <p className="field-hint">
            Open a product to view its details and variations. Use the pencil
            to edit its information.
          </p>
          {!catalog.products.length && (
            <div className="empty-state roomy">
              <h2>Add your first product.</h2>
              <p>
                Choose its artwork, then give each size or style its own variant
                and SKU.
              </p>
            </div>
          )}
          {!!catalog.products.length && !products.length && (
            <p className="notice">No products match your search.</p>
          )}
          <InventoryProductCards products={products} canEdit={canEdit} />
        </section>
      ) : tab === "locations" ? (
        <section>
          <div className="section-heading">
            <h2>Where the work lives.</h2>
            {canEdit && (
              <Button onClick={() => edit("locations")}>Add location</Button>
            )}
          </div>
          {!catalog.locations.length && (
            <div className="empty-state roomy">
              <h2>Start with the studio.</h2>
              <p>
                Add the places you store or sell stock, then receive your first
                print run.
              </p>
            </div>
          )}
          <div className="inv-cards">
            {catalog.locations.map((site) => (
              <article className="inv-panel" key={site.id}>
                <h2>{site.name}</h2>
                <p className="inv-description">
                  {site.kind} / {site.status}
                </p>
                <Badge tone={site.onlineEligible ? "green" : "neutral"}>
                  {site.onlineEligible
                    ? "Website fulfillment"
                    : "Separate from website stock"}
                </Badge>
                {canEdit && (
                  <div className="inv-actions">
                    <Button
                      variant="secondary"
                      onClick={() => edit("locations", site.id)}
                    >
                      Edit location
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : tab === "replenishment" ? (
        <ReplenishmentPanel
          key={stockVersion}
          canEdit={canEdit}
          onViewStock={viewStock}
        />
      ) : (
        <section>
          <Select
            label="Variant to manage"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a variant</option>
            {catalog.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.sku} - {v.name}
                {v.status === "archived" ? " (archived)" : ""}
              </option>
            ))}
          </Select>
          {catalog.variants.find((v) => v.id === selected) ? (
            <InventoryStockPanel
              key={selected + ":" + stockVersion}
              catalog={catalog}
              variant={catalog.variants.find((v) => v.id === selected)!}
              canEdit={canEdit}
            />
          ) : (
            <div className="empty-state roomy">
              <h2>Choose a variant.</h2>
              <p>
                Create a product and SKU in Products &amp; variants to start
                tracking stock.
              </p>
            </div>
          )}
        </section>
      )}
    </>
  );
}
