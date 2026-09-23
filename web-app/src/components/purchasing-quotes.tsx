"use client";
import { useState } from "react";
import type {
  InventoryCatalog,
  PurchasingCatalog,
  QuoteCatalog,
  QuoteRecord,
} from "@sadboi/core";
import { Badge, Button } from "./ui";
import { InventoryForm, Input, Select, value, usd } from "./inventory-form";
import { inventoryRequest } from "@/lib/inventory-client";
function QuoteEditor({
  record,
  purchasing,
  inventory,
  onSaved,
}: {
  record?: QuoteRecord;
  purchasing: PurchasingCatalog;
  inventory: InventoryCatalog;
  onSaved: (id: string) => Promise<void>;
}) {
  const [baseline] = useState(record);
  return (
    <InventoryForm
      endpoint="/api/purchasing"
      action="quote"
      record={baseline}
      label="Save quote"
      successMessage="Quote saved."
      again={false}
      onSaved={onSaved}
      prepare={(data) => ({
        supplierId: value(data, "supplierId"),
        variantId: value(data, "variantId"),
        reference: value(data, "reference"),
        quantity: Number(value(data, "quantity")),
        unitCostMinor: Math.round(Number(value(data, "unitCost")) * 100),
        setupCostMinor: Math.round(Number(value(data, "setupCost")) * 100),
        shippingCostMinor: Math.round(
          Number(value(data, "shippingCost")) * 100,
        ),
        expectedDate: value(data, "expectedDate"),
        expiresDate: value(data, "expiresDate"),
        specification: value(data, "specification"),
        status: value(data, "status"),
        notes: value(data, "notes"),
      })}
    >
      <Select
        label="Supplier"
        name="supplierId"
        required
        defaultValue={baseline?.supplierId ?? ""}
      >
        <option value="">Choose supplier</option>
        {purchasing.suppliers
          .filter((item) => item.status === "active")
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
      </Select>
      <Select
        label="Variant / SKU"
        name="variantId"
        required
        defaultValue={baseline?.variantId ?? ""}
      >
        <option value="">Choose variant</option>
        {inventory.variants
          .filter((item) => item.status === "active")
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.sku} — {item.name}
            </option>
          ))}
      </Select>
      <Input
        label="Quote reference"
        name="reference"
        maxLength={160}
        defaultValue={baseline?.reference}
      />
      <Input
        label="Quantity quoted"
        name="quantity"
        type="number"
        min={1}
        max={1000000}
        step={1}
        required
        defaultValue={baseline?.quantity}
      />
      <Input
        label="Unit cost (USD)"
        name="unitCost"
        inputMode="decimal"
        required
        defaultValue={baseline ? (baseline.unitCostMinor / 100).toFixed(2) : ""}
      />
      <Input
        label="Setup cost (USD)"
        name="setupCost"
        inputMode="decimal"
        required
        defaultValue={
          baseline ? (baseline.setupCostMinor / 100).toFixed(2) : "0.00"
        }
      />
      <Input
        label="Shipping cost (USD)"
        name="shippingCost"
        inputMode="decimal"
        required
        defaultValue={
          baseline ? (baseline.shippingCostMinor / 100).toFixed(2) : "0.00"
        }
      />
      <Input
        label="Expected delivery"
        name="expectedDate"
        type="date"
        defaultValue={baseline?.expectedDate}
      />
      <Input
        label="Quote expires"
        name="expiresDate"
        type="date"
        defaultValue={baseline?.expiresDate}
      />
      <Input
        label="Specification"
        name="specification"
        maxLength={2000}
        required
        defaultValue={baseline?.specification}
        placeholder="Paper, finish, trim, packaging"
      />
      <Input
        label="Notes"
        name="notes"
        maxLength={2000}
        defaultValue={baseline?.notes}
      />
      <Select
        label="Status"
        name="status"
        defaultValue={baseline?.status ?? "received"}
      >
        <option value="draft">Draft</option>
        <option value="received">Received</option>
        <option value="accepted">Accepted for ordering</option>
        <option value="rejected">Rejected</option>
        <option value="expired">Expired</option>
      </Select>
      <p className="field-hint inv-wide">
        Total estimated cost includes quantity × unit cost + setup + shipping.
        Accepting a quote does not place an order or change stock; choose the
        accepted quote when creating a draft order.
      </p>
    </InventoryForm>
  );
}
export function PurchasingQuotes({
  initial,
  purchasing,
  inventory,
  canEdit,
  onChanged,
}: {
  initial: QuoteCatalog;
  purchasing: PurchasingCatalog;
  inventory: InventoryCatalog;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const [catalog, setCatalog] = useState(initial),
    [editing, setEditing] = useState<string | null>(null),
    [query, setQuery] = useState("");
  async function refresh() {
    const next = await inventoryRequest("/api/purchasing?quotes=1");
    setCatalog(next);
    await onChanged();
  }
  async function saved() {
    setEditing(null);
    await refresh();
  }
  const rows = catalog.quotes.filter((item) =>
    (
      item.supplierName +
      " " +
      item.sku +
      " " +
      item.variantName +
      " " +
      item.reference +
      " " +
      item.status
    )
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  if (editing)
    return (
      <section className="inv-panel">
        <div className="section-heading">
          <h2>{editing === "new" ? "Add quote" : "Edit quote"}</h2>
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Close editor
          </Button>
        </div>
        <QuoteEditor
          record={catalog.quotes.find((item) => item.id === editing)}
          purchasing={purchasing}
          inventory={inventory}
          onSaved={saved}
        />
      </section>
    );
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Printer quotes &amp; comparisons</h2>
          <p className="inv-description">
            Compare the full estimated cost, not just the advertised unit price.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setEditing("new")}>Add quote</Button>
        )}
      </div>
      <div className="inv-toolbar">
        <Input
          label="Search quotes by supplier, SKU, reference, or status"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button variant="secondary" onClick={refresh}>
          Refresh quotes
        </Button>
      </div>
      {!rows.length && (
        <div className="empty-state">
          <h2>No quotes yet.</h2>
          <p>
            Record a printer quote to compare runs before creating a purchase
            order.
          </p>
        </div>
      )}
      <div className="inv-cards">
        {rows.map((quote) => (
          <article className="inv-panel" key={quote.id}>
            <div className="section-heading">
              <div>
                <h3>{quote.supplierName}</h3>
                <p className="field-hint">
                  {quote.sku} · {quote.variantName}
                </p>
              </div>
              <Badge
                tone={
                  quote.status === "accepted"
                    ? "green"
                    : quote.status === "rejected"
                      ? "red"
                      : "gold"
                }
              >
                {quote.status}
              </Badge>
            </div>
            <p>
              {quote.quantity} units · {usd(quote.unitCostMinor)} each
            </p>
            <p className="inv-description">
              <strong>{usd(quote.totalMinor)} estimated total</strong>
              <br />
              Effective unit cost: {usd(quote.effectiveUnitCostMinor)}
            </p>
            <p className="field-hint">
              Expected {quote.expectedDate || "unknown"} · Expires{" "}
              {quote.expiresDate || "not set"}
            </p>
            <p className="preserve-lines">{quote.specification}</p>
            {quote.reference && (
              <p className="field-hint">Reference: {quote.reference}</p>
            )}
            {canEdit && (
              <Button variant="secondary" onClick={() => setEditing(quote.id)}>
                Edit quote
              </Button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
