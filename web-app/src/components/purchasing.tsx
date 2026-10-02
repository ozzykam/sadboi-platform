"use client";
import Link from "next/link";
import { useEffect, useState, type ComponentProps } from "react";
import {
  parseUsd,
  purchaseRemaining,
  type PurchasingCatalog,
  type InventoryCatalog,
  type SupplierRecord,
  type PurchaseOrderRecord,
  type PurchaseReceipt,
  type PurchaseLine,
  type QuoteCatalog,
} from "@sadboi/core";
import { Lightbulb } from "lucide-react";
import { inventoryRequest } from "@/lib/inventory-client";
import { Badge, Button, PageHeading } from "./ui";
import {
  InventoryForm,
  Input,
  Select,
  Status,
  value,
  usd,
} from "./inventory-form";
import { OrderProduction, ProductionQueue } from "./purchasing-production";
import { PurchasingQuotes } from "./purchasing-quotes";
import { PurchasingProofs } from "./purchasing-proofs";
import { PurchasingBills } from "./purchasing-bills";
import { PurchasingJournal } from "./purchasing-journal";
import { PurchasingPayments } from "./purchasing-payments";
import type { JournalCatalog, PaymentCatalog } from "@sadboi/core";
import type { FinanceCatalog } from "@sadboi/core";

function PurchasingForm(props: ComponentProps<typeof InventoryForm>) {
  return (
    <InventoryForm
      {...props}
      endpoint="/api/purchasing"
      successMessage="Saved to purchasing."
      again={false}
    />
  );
}
function SupplierEditor({
  record,
  onSaved,
}: {
  record?: SupplierRecord;
  onSaved: (id: string) => Promise<void>;
}) {
  const [baseline] = useState(record);
  return (
    <PurchasingForm
      action="supplier"
      record={baseline}
      onSaved={onSaved}
      label="Save supplier"
      prepare={(data) => ({
        name: value(data, "name"),
        contactName: value(data, "contactName"),
        email: value(data, "email"),
        phone: value(data, "phone"),
        address: value(data, "address"),
        capabilities: value(data, "capabilities"),
        notes: value(data, "notes"),
        status: value(data, "status"),
        leadTimeDays:
          value(data, "leadTimeDays") === ""
            ? null
            : Number(value(data, "leadTimeDays")),
        capacityUnitsPerDay:
          value(data, "capacityUnitsPerDay") === ""
            ? null
            : Number(value(data, "capacityUnitsPerDay")),
      })}
    >
      <Input
        label="Supplier / print shop"
        name="name"
        required
        maxLength={160}
        defaultValue={baseline?.name}
      />
      <Input
        label="Contact person"
        name="contactName"
        maxLength={160}
        defaultValue={baseline?.contactName}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        maxLength={254}
        defaultValue={baseline?.email}
      />
      <Input
        label="Phone"
        name="phone"
        maxLength={80}
        defaultValue={baseline?.phone}
      />
      <Input
        label="Address"
        name="address"
        maxLength={1000}
        defaultValue={baseline?.address}
      />
      <Input
        label="Typical lead time (days, optional)"
        name="leadTimeDays"
        type="number"
        min={0}
        max={3650}
        step={1}
        defaultValue={baseline?.leadTimeDays ?? ""}
      />
      <Input
        label="Typical production capacity (units/day, optional)"
        name="capacityUnitsPerDay"
        type="number"
        min={1}
        max={1000000}
        step={1}
        defaultValue={baseline?.capacityUnitsPerDay ?? ""}
        helperText="Used to estimate run duration for outstanding order units."
      />
      <Input
        label="Capabilities"
        name="capabilities"
        maxLength={2000}
        defaultValue={baseline?.capabilities}
        placeholder="Paper stocks, sizes, finishes, printing methods"
      />
      <Input
        label="Purchasing notes"
        name="notes"
        maxLength={2000}
        defaultValue={baseline?.notes}
        helperText="Visible to super admins and accounting."
      />
      <Status initial={baseline?.status} />
    </PurchasingForm>
  );
}
function OrderEditor({
  record,
  catalog,
  inventory,
  quotes,
  onSaved,
}: {
  record?: PurchaseOrderRecord;
  catalog: PurchasingCatalog;
  inventory: InventoryCatalog;
  quotes: QuoteCatalog;
  onSaved: (id: string) => Promise<void>;
}) {
  const [baseline] = useState(record);
  const [rows, setRows] = useState<Array<{ key: string; line?: PurchaseLine }>>(
    () =>
      baseline?.lines.map((line) => ({ key: line.variantId, line })) ?? [
        { key: "first", line: undefined },
      ],
  );
  return (
    <PurchasingForm
      action="order"
      record={baseline}
      onSaved={onSaved}
      label="Save draft order"
      prepare={(data) => ({
        supplierId: value(data, "supplierId"),
        quoteId: value(data, "quoteId"),
        reference: value(data, "reference"),
        expectedDate: value(data, "expectedDate"),
        notes: value(data, "notes"),
        currency: "USD",
        lines: rows.map((_, index) => ({
          variantId: value(data, "variant-" + index),
          quantity: Number(value(data, "quantity-" + index)),
          unitCostMinor: parseUsd(value(data, "cost-" + index)),
          specification: value(data, "specification-" + index),
        })),
      })}
    >
      <p className="field-hint inv-wide">
        Save a draft to review it. Recording an order as placed freezes its
        quantities, agreed unit costs, and specifications. Supplier
        communication happens outside this app.
      </p>
      <Select
        label="Supplier"
        name="supplierId"
        required
        defaultValue={baseline?.supplierId ?? ""}
      >
        <option value="">Choose supplier</option>
        {catalog.suppliers
          .filter((supplier) => supplier.status === "active")
          .map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
      </Select>
      <Select
        label="Accepted quote (optional)"
        name="quoteId"
        defaultValue={baseline?.quoteId ?? ""}
      >
        <option value="">No quote linked</option>
        {quotes.quotes
          .filter(
            (quote) =>
              quote.status === "accepted" &&
              (!baseline || quote.supplierId === baseline.supplierId),
          )
          .map((quote) => (
            <option key={quote.id} value={quote.id}>
              {quote.supplierName} / {quote.sku} /{" "}
              {usd(quote.effectiveUnitCostMinor)} effective
            </option>
          ))}
      </Select>
      <Input
        label="Supplier quote / reference"
        name="reference"
        maxLength={160}
        defaultValue={baseline?.reference}
      />
      <Input
        label="Expected delivery (optional)"
        name="expectedDate"
        type="date"
        defaultValue={baseline?.expectedDate}
      />
      <Input
        label="Order notes"
        name="notes"
        maxLength={2000}
        defaultValue={baseline?.notes}
      />
      {rows.map(({ key, line }, index) => (
        <section className="inv-panel inv-wide" key={key}>
          <div className="section-heading">
            <h3>Line {index + 1}</h3>
            {rows.length > 1 && (
              <Button
                variant="ghost"
                onClick={() =>
                  setRows((current) => current.filter((row) => row.key !== key))
                }
              >
                Remove line
              </Button>
            )}
          </div>
          <div className="inv-fields purchasing-line">
            <Select
              label="Variant / SKU"
              name={"variant-" + index}
              required
              defaultValue={line?.variantId ?? ""}
            >
              <option value="">Choose variant</option>
              {inventory.variants
                .filter(
                  (variant) =>
                    variant.status === "active" &&
                    inventory.products.some(
                      (product) =>
                        product.id === variant.productId &&
                        product.status === "active",
                    ),
                )
                .map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.sku} â€” {variant.name}
                  </option>
                ))}
            </Select>
            <Input
              label="Units ordered"
              name={"quantity-" + index}
              required
              type="number"
              min={1}
              max={1000000}
              step={1}
              defaultValue={line?.quantity}
            />
            <Input
              label="Agreed unit cost (USD)"
              name={"cost-" + index}
              required
              inputMode="decimal"
              defaultValue={line ? (line.unitCostMinor / 100).toFixed(2) : ""}
              placeholder="12.50"
            />
            <Input
              label="Production specification"
              name={"specification-" + index}
              required
              maxLength={2000}
              defaultValue={line?.specification}
              placeholder="Size, paper, finish, proof / file version agreed with the printer"
            />
          </div>
        </section>
      ))}
      <div className="inv-wide">
        <Button
          variant="secondary"
          disabled={rows.length >= 20}
          onClick={() =>
            setRows((current) => [
              ...current,
              { key: crypto.randomUUID(), line: undefined },
            ])
          }
        >
          Add order line
        </Button>
      </div>
    </PurchasingForm>
  );
}
function ReceiptHistory({ order }: { order: PurchaseOrderRecord }) {
  const [history, setHistory] = useState<{
    receipts: PurchaseReceipt[];
    nextCursor: string | null;
  } | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const path = "/api/purchasing?order=" + order.id;
  useEffect(() => {
    let active = true;
    inventoryRequest(path)
      .then((data) => {
        if (active) setHistory(data);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [path]);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const page = await inventoryRequest(
        path + (history?.nextCursor ? "&cursor=" + history.nextCursor : ""),
      );
      setHistory((current) => ({
        receipts: [...(current?.receipts ?? []), ...page.receipts],
        nextCursor: page.nextCursor,
      }));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load receipts.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="inv-section">
      <h2>Delivery history</h2>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!history && !error && <p role="status">Loading deliveries...</p>}
      {history?.receipts.length === 0 && (
        <p className="inv-description">No deliveries recorded.</p>
      )}
      <ol className="inv-history">
        {history?.receipts.map((receipt) => (
          <li key={receipt.id}>
            <strong>
              {receipt.sku} Â· {receipt.locationName}
            </strong>
            <p>
              {receipt.accepted} accepted / {receipt.quarantined} quarantined /{" "}
              {receipt.rejected} rejected
            </p>
            <p className="preserve-lines">
              {receipt.reason}
              {receipt.reference && " / " + receipt.reference}
            </p>
            <time dateTime={receipt.createdAt}>
              {new Date(receipt.createdAt).toLocaleString()}
            </time>
          </li>
        ))}
      </ol>
      {(error || history?.nextCursor) && (
        <Button variant="secondary" disabled={busy} onClick={load}>
          {error ? "Retry deliveries" : "Load older deliveries"}
        </Button>
      )}
    </section>
  );
}
function OrderDetail({
  order,
  inventory,
  canEdit,
  onSaved,
  onEdit,
}: {
  order: PurchaseOrderRecord;
  inventory: InventoryCatalog;
  canEdit: boolean;
  onSaved: (id: string) => Promise<void>;
  onEdit: () => void;
}) {
  const open = ["ordered", "partially_received"].includes(order.status);
  const outstanding = order.lines.reduce(
    (sum, line) => sum + purchaseRemaining(line),
    0,
  );
  return (
    <section className="inv-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{order.number}</p>
          <h2>{order.supplier.name}</h2>
        </div>
        <Badge>{order.status.replaceAll("_", " ")}</Badge>
      </div>
      <p className="inv-description">
        {order.supplier.contactName}
        {order.supplier.email && " / " + order.supplier.email}
        {order.supplier.phone && " / " + order.supplier.phone}
      </p>
      <p className="field-hint">
        Supplier reference: {order.reference || "None"} / Expected:{" "}
        {order.expectedDate || "Not set"}
      </p>
      {order.quoteSnapshot && (
        <p className="field-hint">
          Accepted quote{" "}
          {order.quoteSnapshot.reference || order.quoteSnapshot.id}:{" "}
          {usd(order.quoteSnapshot.totalMinor)} total /{" "}
          {usd(order.quoteSnapshot.effectiveUnitCostMinor)} effective per unit.
          Quote specification is preserved on this order.
        </p>
      )}
      <PurchasingProofs order={order} canEdit={canEdit} />
      {order.notes && <p className="inv-description">{order.notes}</p>}
      <ul className="inv-variants">
        {order.lines.map((line) => (
          <li key={line.variantId}>
            <div>
              <strong>
                {line.sku} â€” {line.variantName}
              </strong>
              <p>{line.productTitle}</p>
              <p>
                {line.quantity} ordered Ã— {usd(line.unitCostMinor)} ={" "}
                {usd(line.quantity * line.unitCostMinor)}
              </p>
              <p className="preserve-lines">{line.specification}</p>
              <p>
                {line.accepted} accepted / {line.quarantined} quarantined /{" "}
                {line.rejected} rejected / {line.cancelled} cancelled /{" "}
                {purchaseRemaining(line)} outstanding
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="inv-description">
        <strong>Production subtotal {usd(order.subtotalMinor)}</strong>
      </p>
      <p className="field-hint">
        Original ordered subtotal. Freight, tax, supplier bills, and ledger
        posting are not included. Review receiving outcomes when settling the
        supplier account.
      </p>
      {order.closeReason && (
        <p className="notice">Closed: {order.closeReason}</p>
      )}
      {canEdit && order.status === "draft" && (
        <>
          <div className="inv-actions">
            <Button variant="secondary" onClick={onEdit}>
              Edit draft
            </Button>
          </div>
          <PurchasingForm
            key={"place:" + order.revision}
            action="status"
            label="Record order placed"
            onSaved={onSaved}
            prepare={(data) => ({
              orderId: order.id,
              expectedRevision: order.revision,
              action: "place",
              reason: value(data, "reason"),
            })}
          >
            <Input
              label="Supplier confirmation / reason"
              name="reason"
              required
              minLength={3}
              maxLength={1000}
            />
            <label className="inv-check inv-wide">
              <input type="checkbox" required />I reviewed these lines and
              placed this order with the supplier.
            </label>
          </PurchasingForm>
        </>
      )}
      {order.status !== "draft" && (
        <OrderProduction order={order} canEdit={canEdit} onSaved={onSaved} />
      )}
      {canEdit && open && (
        <section className="inv-section">
          <h2>Record a delivery</h2>
          <p className="inv-description">
            Record each delivered SKU once. Retained damaged units go into
            quarantine. Rejected units must have been returned to or retained by
            the supplier; they do not enter your physical stock.
          </p>
          <PurchasingForm
            key={"receive:" + order.revision}
            action="receipt"
            label="Record delivery & update stock"
            onSaved={onSaved}
            prepare={(data) => ({
              orderId: order.id,
              variantId: value(data, "variantId"),
              locationId: value(data, "locationId"),
              accepted: Number(value(data, "accepted")),
              quarantined: Number(value(data, "quarantined")),
              rejected: Number(value(data, "rejected")),
              reason: value(data, "reason"),
              reference: value(data, "reference"),
            })}
          >
            <Select
              label="Delivered SKU"
              name="variantId"
              required
              defaultValue=""
            >
              <option value="">Choose order line</option>
              {order.lines
                .filter((line) => purchaseRemaining(line) > 0)
                .map((line) => (
                  <option key={line.variantId} value={line.variantId}>
                    {line.sku} â€” {purchaseRemaining(line)} outstanding
                  </option>
                ))}
            </Select>
            <Select
              label="Receiving location"
              name="locationId"
              required
              defaultValue=""
            >
              <option value="">Choose location</option>
              {inventory.locations
                .filter((site) => site.status === "active")
                .map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
            </Select>
            <Input
              label="Accepted units"
              name="accepted"
              type="number"
              required
              min={0}
              max={1000000}
              step={1}
              defaultValue={0}
            />
            <Input
              label="Damaged / unapproved units kept"
              name="quarantined"
              type="number"
              required
              min={0}
              max={1000000}
              step={1}
              defaultValue={0}
            />
            <Input
              label="Rejected units not kept"
              name="rejected"
              type="number"
              required
              min={0}
              max={1000000}
              step={1}
              defaultValue={0}
            />
            <Input
              label="Inspection notes / reason"
              name="reason"
              required
              minLength={3}
              maxLength={1000}
            />
            <Input
              label="Delivery reference (optional)"
              name="reference"
              maxLength={160}
            />
            <p className="field-hint inv-wide">
              All three outcomes count against ordered units. Record replacement
              units on a new order, referencing this order. Use this form for
              these deliveries so inventory is not received a second time
              elsewhere.
            </p>
          </PurchasingForm>
        </section>
      )}
      {canEdit && !["closed", "cancelled"].includes(order.status) && (
        <details className="inv-guide inv-section">
          <summary>
            {order.status === "draft"
              ? "Cancel this draft"
              : "Close this order"}
          </summary>
          <PurchasingForm
            key={"close:" + order.revision}
            action="status"
            label={order.status === "draft" ? "Cancel draft" : "Close order"}
            onSaved={onSaved}
            prepare={(data) => ({
              orderId: order.id,
              expectedRevision: order.revision,
              action: "close",
              reason: value(data, "reason"),
            })}
          >
            <p className="field-hint inv-wide">
              {outstanding} outstanding units will be cancelled. Existing
              deliveries and stock stay recorded.
            </p>
            <Input
              label="Closing reason"
              name="reason"
              required
              minLength={3}
              maxLength={1000}
            />
            <label className="inv-check inv-wide">
              <input type="checkbox" required />I have resolved the remaining
              commitment with the supplier.
            </label>
          </PurchasingForm>
        </details>
      )}
      <ReceiptHistory key={order.id + ":" + order.revision} order={order} />
    </section>
  );
}

export function Purchasing({
  initial,
  initialInventory,
  initialQuotes,
  initialFinance,
  initialJournal,
  initialPayments,
  canEdit,
}: {
  initial: PurchasingCatalog;
  initialInventory: InventoryCatalog;
  initialQuotes: QuoteCatalog;
  initialFinance: FinanceCatalog;
  initialJournal: JournalCatalog;
  initialPayments: PaymentCatalog;
  canEdit: boolean;
}) {
  const [catalog, setCatalog] = useState(initial),
    [inventory, setInventory] = useState(initialInventory),
    [quotes, setQuotes] = useState(initialQuotes),
    [finance, setFinance] = useState(initialFinance),
    [journal, setJournal] = useState(initialJournal),
    [payments, setPayments] = useState(initialPayments);
  const [tab, setTab] = useState<
    | "orders"
    | "suppliers"
    | "production"
    | "quotes"
    | "bills"
    | "journal"
    | "payments"
  >("orders");
  const [editing, setEditing] = useState<{
    kind: "supplier" | "order";
    id: string;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(null),
    [query, setQuery] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const [purchasing, stock, quotePage, billPage, journalPage, paymentPage] =
        await Promise.all([
          inventoryRequest("/api/purchasing"),
          inventoryRequest("/api/inventory"),
          inventoryRequest("/api/purchasing?quotes=1"),
          inventoryRequest("/api/purchasing?bills=1"),
          inventoryRequest("/api/purchasing?journal=1"),
          inventoryRequest("/api/purchasing?payments=1"),
        ]);
      setCatalog(purchasing);
      setInventory(stock);
      setQuotes(quotePage);
      setFinance(billPage);
      setJournal(journalPage);
      setPayments(paymentPage);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load purchasing.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saved(id: string) {
    if (editing?.kind !== "supplier") setSelected(id);
    setEditing(null);
    await refresh();
  }
  const order = catalog.orders.find((item) => item.id === selected);
  const orders = catalog.orders.filter((item) =>
    (
      item.number +
      " " +
      item.supplier.name +
      " " +
      item.reference +
      " " +
      item.status
    )
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="PURCHASING / PRINT PRODUCTION"
        title="From print shop to studio."
        description="Suppliers, agreed orders, and inspected deliveries connected to your stock."
        action={
          <Button variant="secondary" disabled={busy} onClick={refresh}>
            {busy ? "Refreshing..." : "Refresh purchasing"}
          </Button>
        }
      />
      {!canEdit && (
        <p className="notice">
          Accounting access: view suppliers, orders, costs, and delivery
          history.
        </p>
      )}
      <p className="howto-context">
        <Link className="inline-link howto-link" href="/admin/how-to#quotes">
          <Lightbulb size={14} /> Compare printer quotes
        </Link><br/>
        <Link className="inline-link howto-link" href="/admin/how-to#purchasing">
          <Lightbulb size={14} /> Create a supplier order
        </Link><br/>
        <Link className="inline-link howto-link" href="/admin/how-to#deliveries">
          <Lightbulb size={14} /> Receive deliveries &amp; update stock
        </Link>
      </p>
      {error && (
        <p role="alert" className="notice error">
          {error} Use Refresh purchasing to load saved records.
        </p>
      )}
      <nav className="inv-tabs" aria-label="Purchasing sections">
        {(
          [
            "orders",
            "quotes",
            "production",
            "bills",
            "payments",
            "journal",
            "suppliers",
          ] as const
        ).map((section) => (
          <Button
            key={section}
            variant="secondary"
            aria-pressed={tab === section}
            onClick={() => {
              setTab(section);
              setEditing(null);
              setSelected(null);
            }}
          >
            {section === "orders"
              ? "Purchase orders"
              : section === "production"
                ? "Production"
                : section === "quotes"
                  ? "Quotes"
                  : section === "bills"
                    ? "Vendor bills"
                    : section === "payments"
                      ? "Payments"
                      : section === "journal"
                        ? "Journal"
                        : "Suppliers"}
          </Button>
        ))}
        <Link className="button ghost" href="/admin/inventory">
          Open inventory
        </Link>
      </nav>
      {editing ? (
        <section className="inv-panel">
          <div className="section-heading">
            <h2>
              {editing.id === "new" ? "Add" : "Edit"}{" "}
              {editing.kind === "supplier" ? "supplier" : "draft order"}
            </h2>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Close editor
            </Button>
          </div>
          {editing.kind === "supplier" ? (
            <SupplierEditor
              key={editing.id}
              record={catalog.suppliers.find((item) => item.id === editing.id)}
              onSaved={saved}
            />
          ) : (
            <OrderEditor
              key={editing.id}
              record={catalog.orders.find((item) => item.id === editing.id)}
              catalog={catalog}
              inventory={inventory}
              quotes={quotes}
              onSaved={saved}
            />
          )}
        </section>
      ) : tab === "quotes" ? (
        <PurchasingQuotes
          initial={quotes}
          purchasing={catalog}
          inventory={inventory}
          canEdit={canEdit}
          onChanged={refresh}
        />
      ) : tab === "bills" ? (
        <PurchasingBills
          initial={finance}
          purchasing={catalog}
          canEdit={canEdit}
          onChanged={refresh}
        />
      ) : tab === "payments" ? (
        <PurchasingPayments
          initial={payments}
          finance={finance}
          canEdit={canEdit}
          onChanged={refresh}
        />
      ) : tab === "journal" ? (
        <PurchasingJournal
          initial={journal}
          finance={finance}
          canEdit={canEdit}
          onChanged={refresh}
        />
      ) : tab === "production" ? (
        <ProductionQueue
          orders={catalog.orders}
          onViewOrder={(id) => {
            setSelected(id);
            setTab("orders");
          }}
        />
      ) : tab === "suppliers" ? (
        <>
          <div className="section-heading">
            <h2>Print shops &amp; suppliers</h2>
            {canEdit && (
              <Button
                onClick={() => setEditing({ kind: "supplier", id: "new" })}
              >
                Add supplier
              </Button>
            )}
          </div>
          {!catalog.suppliers.length && (
            <p className="notice">
              Start with the shop or supplier you order from, including its
              capabilities and lead time.
            </p>
          )}
          <div className="inv-cards">
            {catalog.suppliers.map((supplier) => (
              <article className="inv-panel" key={supplier.id}>
                <h3>{supplier.name}</h3>
                <Badge>{supplier.status}</Badge>
                <p className="inv-description">
                  {supplier.contactName}
                  {supplier.email && " / " + supplier.email}
                  {supplier.phone && " / " + supplier.phone}
                </p>
                <p className="preserve-lines">{supplier.address}</p>
                <p className="inv-description">{supplier.capabilities}</p>
                <p className="field-hint">
                  Lead time:{" "}
                  {supplier.leadTimeDays === null
                    ? "Not recorded"
                    : supplier.leadTimeDays + " days"}{" "}
                  · Capacity:{" "}
                  {supplier.capacityUnitsPerDay
                    ? supplier.capacityUnitsPerDay + " units/day"
                    : "Not recorded"}
                </p>
                <p className="inv-description">{supplier.notes}</p>
                {canEdit && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setEditing({ kind: "supplier", id: supplier.id })
                    }
                  >
                    Edit supplier
                  </Button>
                )}
              </article>
            ))}
          </div>
        </>
      ) : order ? (
        <>
          <Button variant="ghost" onClick={() => setSelected(null)}>
            Back to orders
          </Button>
          <OrderDetail
            key={order.id}
            order={order}
            inventory={inventory}
            canEdit={canEdit}
            onSaved={saved}
            onEdit={() => setEditing({ kind: "order", id: order.id })}
          />
        </>
      ) : (
        <>
          <details className="inv-guide" open={!catalog.orders.length}>
            <summary>How purchasing updates stock</summary>
            <ol>
              <li>Add a supplier and your inventory SKUs.</li>
              <li>
                Create a draft order with quantities, agreed costs, and print
                specifications.
              </li>
              <li>
                Review the draft and record it as placed after confirming with
                the supplier.
              </li>
              <li>
                Record partial deliveries here. Accepted units enter available
                stock; retained damaged units stay in quarantine.
              </li>
            </ol>
          </details>
          <div className="inv-toolbar">
            <Input
              label="Search order, supplier, reference, or status"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {canEdit && (
              <Button onClick={() => setEditing({ kind: "order", id: "new" })}>
                Create purchase order
              </Button>
            )}
          </div>
          {canEdit &&
            (!catalog.suppliers.some(
              (supplier) => supplier.status === "active",
            ) ||
              !inventory.variants.some(
                (variant) => variant.status === "active",
              )) && (
              <p className="notice">
                Add an active supplier in Suppliers and an artwork-linked
                variant in{" "}
                <Link className="inline-link" href="/admin/inventory">
                  Inventory
                </Link>{" "}
                before creating an order.
              </p>
            )}
          {!orders.length && (
            <div className="empty-state">
              <h2>
                {catalog.orders.length
                  ? "No matching orders."
                  : "Your next print run starts here."}
              </h2>
              <p>
                Track what you ordered, what arrived, and which units passed
                inspection.
              </p>
            </div>
          )}
          <div className="inv-cards">
            {orders.map((item) => (
              <article className="inv-panel" key={item.id}>
                <Badge>{item.status.replaceAll("_", " ")}</Badge>
                <h3 className="inv-description">
                  {item.number} Â· {item.supplier.name}
                </h3>
                <p>
                  {item.lines.length} SKU lines / {usd(item.subtotalMinor)}
                </p>
                <p className="field-hint">
                  Expected {item.expectedDate || "date not set"} /{" "}
                  {item.lines.reduce(
                    (sum, line) => sum + purchaseRemaining(line),
                    0,
                  )}{" "}
                  units outstanding
                </p>
                <div className="inv-actions">
                  <Button
                    variant="secondary"
                    onClick={() => setSelected(item.id)}
                  >
                    Review order
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
