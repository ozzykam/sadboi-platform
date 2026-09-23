"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  productionStages,
  purchaseRemaining,
  purchaseProductionQueue,
  type ProductionStage,
  type PurchaseOrderRecord,
  type PurchaseProductionUpdate,
} from "@sadboi/core";
import { inventoryRequest } from "@/lib/inventory-client";
import { Badge, Button } from "./ui";
import { InventoryForm, Input, Select, value } from "./inventory-form";
import { ProductionBatches } from "./purchasing-batches";

const labels: Record<ProductionStage | "unreported", string> = {
  unreported: "No update yet",
  queued: "Queued with supplier",
  proofing: "Proof in progress",
  in_production: "In production",
  ready: "Ready for collection / dispatch",
  shipped: "Shipped by supplier",
  on_hold: "On hold",
};

export function ProductionQueue({
  orders,
  onViewOrder,
}: {
  orders: PurchaseOrderRecord[];
  onViewOrder: (id: string) => void;
}) {
  const [stage, setStage] = useState("all"),
    [search, setSearch] = useState("");
  const queue = purchaseProductionQueue(orders);
  const filtered = queue.filter(
    (item) =>
      (stage === "all" || item.stage === stage) &&
      [
        item.orderNumber,
        item.supplierName,
        item.sku,
        item.variantName,
        item.reference,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section>
      <div className="section-heading">
        <h2>Outstanding supplier work</h2>
        <Link className="inline-link" href="/admin/how-to#production">
          How to track production
        </Link>
      </div>
      <p className="inv-description">
        One entry per outstanding SKU on a placed order, sorted by expected
        delivery date with unknown dates last. Supplier progress is recorded
        manually; stock changes only when you record deliveries.
      </p>
      <div className="inv-fields">
        <Input
          label="Search production by order, supplier, SKU, or reference"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          label="Production stage"
          value={stage}
          onChange={(event) => setStage(event.target.value)}
        >
          <option value="all">All stages</option>
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <p className="field-hint">
        {filtered.length} of {queue.length} outstanding SKU lines
      </p>
      {!filtered.length && (
        <div className="empty-state">
          <h3>
            {queue.length
              ? "No matching supplier work."
              : "No outstanding supplier work."}
          </h3>
          <p>
            {queue.length
              ? "Try a different search or stage."
              : "Place a purchase order to begin tracking its production here."}
          </p>
        </div>
      )}
      <div className="inv-cards">
        {filtered.map((item) => (
          <article
            className="inv-panel"
            key={item.orderId + ":" + item.variantId}
          >
            <Badge tone={item.stage === "on_hold" ? "gold" : "neutral"}>
              {labels[item.stage]}
            </Badge>
            <h3 className="inv-description">
              {item.sku} · {item.variantName}
            </h3>
            <p>
              {item.orderNumber} · {item.supplierName}
            </p>
            <p className="inv-description">
              {item.outstanding} units outstanding
              <br />
              Expected delivery: {item.expectedDate || "Unknown"}
            </p>
            <p className="field-hint">
              Estimated run time:{" "}
              {item.estimatedProductionDays === null
                ? "Capacity not recorded"
                : item.estimatedProductionDays +
                  " production day" +
                  (item.estimatedProductionDays === 1 ? "" : "s")}
            </p>
            {item.note && <p className="preserve-lines">{item.note}</p>}
            {item.reference && (
              <p className="field-hint">Reference: {item.reference}</p>
            )}
            <div className="inv-actions">
              <Button
                variant="secondary"
                onClick={() => onViewOrder(item.orderId)}
              >
                Review order &amp; production
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductionHistory({ orderId }: { orderId: string }) {
  const [history, setHistory] = useState<{
    updates: PurchaseProductionUpdate[];
    nextCursor: string | null;
  } | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const path = "/api/purchasing?history=production&order=" + orderId;
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
        updates: [...(current?.updates ?? []), ...page.updates],
        nextCursor: page.nextCursor,
      }));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not load production history.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="inv-section">
      <h3>Production update history</h3>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {!history && !error && (
        <p role="status" className="inv-description">
          Loading production updates...
        </p>
      )}
      {history?.updates.length === 0 && (
        <p className="inv-description">No production updates recorded.</p>
      )}
      <ol className="inv-history">
        {history?.updates.map((update) => (
          <li key={update.id}>
            <div className="inv-history-title">
              <strong>{update.sku}</strong>
              <Badge>{labels[update.stage]}</Badge>
            </div>
            <p>Expected delivery: {update.expectedDate || "Unknown"}</p>
            <p className="preserve-lines">{update.note}</p>
            {update.reference && <p>Reference: {update.reference}</p>}
            <time dateTime={update.createdAt}>
              {new Date(update.createdAt).toLocaleString()}
            </time>
          </li>
        ))}
      </ol>
      {(error || history?.nextCursor) && (
        <Button variant="secondary" disabled={busy} onClick={load}>
          {error ? "Retry production history" : "Load older production updates"}
        </Button>
      )}
    </section>
  );
}

function ProductionEditor({
  order,
  variantId,
  onSaved,
}: {
  order: PurchaseOrderRecord;
  variantId: string;
  onSaved: (id: string) => Promise<void>;
}) {
  const [baseline] = useState(order);
  const latest = baseline.production.find(
    (update) => update.variantId === variantId,
  );
  return (
    <InventoryForm
      endpoint="/api/purchasing"
      action="production"
      label="Save production update"
      successMessage="Production update saved."
      again={false}
      onSaved={onSaved}
      prepare={(data) => ({
        orderId: baseline.id,
        variantId,
        expectedRevision: baseline.revision,
        stage: value(data, "stage"),
        expectedDate: value(data, "expectedDate"),
        note: value(data, "note"),
        reference: value(data, "reference"),
      })}
    >
      <Select
        label="Latest supplier stage"
        name="stage"
        defaultValue={latest?.stage ?? "queued"}
      >
        {productionStages.map((stage) => (
          <option key={stage} value={stage}>
            {labels[stage]}
          </option>
        ))}
      </Select>
      <Input
        label="Current expected delivery date"
        name="expectedDate"
        type="date"
        defaultValue={latest ? latest.expectedDate : baseline.expectedDate}
        helperText="Leave blank if unknown. This updates the forecast for this SKU, preserving the original expected delivery date."
      />
      <Input
        label="Supplier update / reason for change"
        name="note"
        required
        minLength={3}
        maxLength={1000}
        placeholder="Supplier confirmed printing; delivery now expected next Friday"
      />
      <Input
        label="Confirmation / shipment reference (optional)"
        name="reference"
        maxLength={160}
      />
      <p className="field-hint inv-wide">
        Record the latest situation for the remaining units of this SKU. Any
        stage can be corrected with a reason. This does not approve a proof,
        change ordered quantities, or receive stock.
      </p>
    </InventoryForm>
  );
}

export function OrderProduction({
  order,
  canEdit,
  onSaved,
}: {
  order: PurchaseOrderRecord;
  canEdit: boolean;
  onSaved: (id: string) => Promise<void>;
}) {
  const remaining = order.lines.filter((line) => purchaseRemaining(line) > 0);
  const [chosen, setChosen] = useState("");
  const variantId = remaining.some((line) => line.variantId === chosen)
    ? chosen
    : (remaining[0]?.variantId ?? "");
  const open = ["ordered", "partially_received"].includes(order.status);
  return (
    <section className="inv-section">
      <div className="section-heading">
        <h2>Supplier production</h2>
        <Link className="inline-link" href="/admin/how-to#production">
          Production walkthrough
        </Link>
      </div>
      <p className="inv-description">
        Track supplier progress and revised delivery forecasts for each SKU.
        Original expected delivery: {order.expectedDate || "Not set"}.
      </p>
      {!!order.production.length && (
        <ul className="inv-variants">
          {order.production.map((update) => (
            <li key={update.variantId}>
              <div>
                <strong>{update.sku}</strong>
                <p>
                  {labels[update.stage]} / Expected delivery:{" "}
                  {update.expectedDate || "Unknown"}
                </p>
                <p className="preserve-lines">{update.note}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {canEdit && open && !!variantId && (
        <>
          <Select
            label="SKU to update"
            value={variantId}
            onChange={(event) => setChosen(event.target.value)}
          >
            {remaining.map((line) => (
              <option key={line.variantId} value={line.variantId}>
                {line.sku} — {purchaseRemaining(line)} outstanding
              </option>
            ))}
          </Select>
          <ProductionEditor
            key={order.id + ":" + order.revision + ":" + variantId}
            order={order}
            variantId={variantId}
            onSaved={onSaved}
          />
        </>
      )}
      {!open && (
        <p className="field-hint">
          Production updates are available while a placed order has units
          outstanding. Its previous updates remain in history.
        </p>
      )}
      <ProductionHistory
        key={order.id + ":" + order.revision}
        orderId={order.id}
      />
      <ProductionBatches order={order} canEdit={canEdit} />
    </section>
  );
}
