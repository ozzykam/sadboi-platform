"use client";

import { useEffect, useState } from "react";
import {
  parseUsd,
  stockAvailable,
  type InventoryCatalog,
  type InventoryStock,
  type MovementInput,
  type StockTransfer,
  type StockVariantRecord,
} from "@sadboi/core";
import { inventoryRequest } from "@/lib/inventory-client";
import { Badge, Button } from "./ui";
import { Input, InventoryForm, Select, usd, value } from "./inventory-form";
import { InventoryPlanning } from "./inventory-planning";

const movementLabels: Record<MovementInput["kind"], string> = {
  receive: "Receive accepted stock",
  receive_quarantined: "Receive damaged / unapproved stock",
  adjust: "Correct a stock count",
  quarantine: "Set stock aside",
  release: "Approve stock for sale",
  discard: "Discard unavailable stock",
};
const historyLabels: Record<string, string> = {
  ...movementLabels,
  purchase_received: "Purchase order delivery",
  stocktake: "Physical stock count",
  dispatch: "Transfer dispatched",
  transfer_received: "Transfer received",
  transfer_quarantined: "Transfer received into quarantine",
  transfer_loss: "Transfer loss recorded",
};

function MovementForm({
  catalog,
  variant,
  stock,
  onSaved,
}: {
  catalog: InventoryCatalog;
  variant: StockVariantRecord;
  stock: InventoryStock;
  onSaved: () => Promise<void>;
}) {
  const [kind, setKind] = useState<MovementInput["kind"] | "dispatch">(
    "receive",
  );
  const sites = catalog.locations.filter((site) => site.status === "active");
  const receiving = kind === "receive" || kind === "receive_quarantined";
  const [locationId, setLocationId] = useState(sites[0]?.id ?? "");
  const current = stock.balances.find(
    (balance) => balance.locationId === locationId,
  );
  const revision = current?.revision ?? 0;
  const available = current ? stockAvailable(current) : 0;
  function prepare(data: FormData) {
    const common = {
      variantId: variant.id,
      quantity: Number(value(data, "quantity")),
      reason: value(data, "reason"),
      reference: value(data, "reference"),
    };
    if (kind === "dispatch")
      return { ...common, fromId: locationId, toId: value(data, "toId") };
    return {
      ...common,
      kind,
      locationId,
      expectedRevision: receiving ? null : revision,
      unitCostMinor:
        receiving && value(data, "unitCost")
          ? parseUsd(value(data, "unitCost"))
          : null,
    };
  }
  if (!sites.length)
    return (
      <p className="notice">
        Add an active location in Locations before recording stock.
      </p>
    );
  return (
    <section className="inv-panel">
      <h2>Record stock movement</h2>
      <InventoryForm
        action={kind === "dispatch" ? "dispatch" : "movement"}
        prepare={prepare}
        onSaved={onSaved}
        label="Record movement"
      >
        <Select
          label="Action"
          value={kind}
          onChange={(event) => setKind(event.target.value as typeof kind)}
        >
          {Object.entries(movementLabels).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
          <option value="dispatch">Dispatch a transfer</option>
        </Select>
        <Select
          label={kind === "dispatch" ? "From location" : "Location"}
          value={locationId}
          required
          onChange={(event) => setLocationId(event.target.value)}
        >
          {sites.map((site) => (
            <option value={site.id} key={site.id}>
              {site.name}
            </option>
          ))}
        </Select>
        {kind === "dispatch" && (
          <Select label="To location" name="toId" required defaultValue="">
            <option value="">Choose destination</option>
            {sites
              .filter((site) => site.id !== locationId)
              .map((site) => (
                <option value={site.id} key={site.id}>
                  {site.name}
                </option>
              ))}
          </Select>
        )}
        <Input
          label={
            kind === "adjust" ? "Count correction (+ or - units)" : "Quantity"
          }
          name="quantity"
          required
          type="number"
          min={kind === "adjust" ? -1000000 : 1}
          max={1000000}
          step={1}
        />
        {receiving && (
          <Input
            label="Unit cost (USD, optional)"
            name="unitCost"
            inputMode="decimal"
            placeholder="12.50"
            helperText="Recorded for reference; does not create an accounting entry."
          />
        )}
        <Input
          label="Reason"
          name="reason"
          required
          minLength={3}
          maxLength={1000}
          placeholder="Print run received, count correction, or damage details"
        />
        <Input
          label="Reference (optional)"
          name="reference"
          maxLength={160}
          placeholder="Supplier, receipt, event, or delivery reference"
        />
        <p className="field-hint inv-wide">
          {available} available / {current?.unavailable ?? 0} unavailable at
          this location.
          {kind === "adjust" &&
            " Enter the difference from the recorded count, not the new total. Refresh inventory if this balance has changed."}
          {kind === "dispatch" &&
            " Dispatched units stay in transit until received; they are not available at either location."}
          {kind === "receive_quarantined" &&
            " These units remain unavailable until approved."}
          {kind === "quarantine" &&
            " Sets aside available stock without removing it from the physical count."}
          {kind === "discard" &&
            " Removes only units already marked unavailable."}
          {kind === "release" &&
            " Returns previously unavailable units to available stock after approval."}
        </p>
      </InventoryForm>
    </section>
  );
}

function TransferCard({
  transfer,
  canEdit,
  onSaved,
}: {
  transfer: StockTransfer;
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  return (
    <article className="inv-panel">
      <h3>
        {transfer.fromName} → {transfer.toName}
      </h3>
      <p className="inv-description">
        {transfer.remaining} in transit / {transfer.received} received /{" "}
        {transfer.lost} lost
      </p>
      <p className="field-hint preserve-lines">
        {transfer.reason}
        {transfer.reference && " / " + transfer.reference}
      </p>
      {canEdit && (
        <InventoryForm
          action="receipt"
          prepare={(data) => ({
            transferId: transfer.id,
            kind: value(data, "kind"),
            quantity: Number(value(data, "quantity")),
            reason: value(data, "reason"),
          })}
          onSaved={onSaved}
          label="Record transfer outcome"
        >
          <Select label="Outcome" name="kind" defaultValue="receive">
            <option value="receive">Received and accepted</option>
            <option value="receive_quarantined">
              Received damaged / unapproved
            </option>
            <option value="loss">Lost in transit</option>
          </Select>
          <Input
            label="Units in this outcome"
            name="quantity"
            required
            type="number"
            min={1}
            max={transfer.remaining}
            step={1}
          />
          <Input
            label="Outcome notes"
            name="reason"
            required
            minLength={3}
            maxLength={1000}
          />
          <p className="field-hint inv-wide">
            Record partial deliveries separately. Damaged units enter
            quarantine; lost units never enter destination stock.
          </p>
        </InventoryForm>
      )}
    </article>
  );
}

export function InventoryStockPanel({
  catalog,
  variant,
  canEdit,
}: {
  catalog: InventoryCatalog;
  variant: StockVariantRecord;
  canEdit: boolean;
}) {
  const [stock, setStock] = useState<InventoryStock | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const path = "/api/inventory/stock?variant=" + variant.id;
  useEffect(() => {
    let active = true;
    inventoryRequest(path)
      .then((data) => {
        if (active) setStock(data);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [path]);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setStock(await inventoryRequest(path));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not refresh stock. Use Refresh stock to retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function more() {
    if (!stock?.nextCursor) return;
    setBusy(true);
    setError("");
    try {
      const page: InventoryStock = await inventoryRequest(
        path + "&cursor=" + stock.nextCursor,
      );
      setStock(
        (current) =>
          current && {
            ...current,
            movements: [...current.movements, ...page.movements],
            nextCursor: page.nextCursor,
          },
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not load movement history.",
      );
    } finally {
      setBusy(false);
    }
  }
  const activeProduct =
    catalog.products.find((product) => product.id === variant.productId)
      ?.status === "active";
  const eligible =
    stock?.balances.reduce((sum, balance) => {
      const site = catalog.locations.find(
        (location) => location.id === balance.locationId,
      );
      return (
        sum +
        (site?.status === "active" &&
        site.onlineEligible &&
        site.kind !== "transit" &&
        activeProduct &&
        variant.status === "active" &&
        variant.fulfillment === "stocked"
          ? stockAvailable(balance)
          : 0)
      );
    }, 0) ?? 0;
  return (
    <div className="inv-stock">
      <div className="section-heading">
        <div>
          <h2>{variant.name}</h2>
          <p className="field-hint">{variant.sku}</p>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={busy}>
          {busy ? "Refreshing..." : "Refresh stock"}
        </Button>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!stock ? (
        <p className="notice" role="status">
          {error
            ? "Stock could not be loaded. Retry with Refresh stock."
            : "Loading stock..."}
        </p>
      ) : (
        <>
          <p className="inv-description">
            <strong>{eligible}</strong> physical units eligible for website
            fulfillment.{" "}
            <span className="field-hint">
              Checkout and reservations are not enabled yet.
            </span>
          </p>
          <div className="inv-cards">
            {catalog.locations
              .filter(
                (site) =>
                  site.status === "active" ||
                  stock.balances.some(
                    (balance) =>
                      balance.locationId === site.id && balance.onHand > 0,
                  ),
              )
              .map((site) => {
                const balance = stock.balances.find(
                  (item) => item.locationId === site.id,
                );
                return (
                  <article className="inv-panel" key={site.id}>
                    <h3>{site.name}</h3>
                    <p className="field-hint">{site.kind}</p>
                    <dl className="inv-balances">
                      <div>
                        <dt>On hand</dt>
                        <dd>{balance?.onHand ?? 0}</dd>
                      </div>
                      <div>
                        <dt>Available here</dt>
                        <dd>{balance ? stockAvailable(balance) : 0}</dd>
                      </div>
                      <div>
                        <dt>Unavailable</dt>
                        <dd>{balance?.unavailable ?? 0}</dd>
                      </div>
                      <div>
                        <dt>Reserved / allocated</dt>
                        <dd>
                          {balance?.reserved ?? 0} / {balance?.allocated ?? 0}
                        </dd>
                      </div>
                    </dl>
                    <Badge tone={site.onlineEligible ? "green" : "neutral"}>
                      {site.onlineEligible
                        ? "Website fulfillment"
                        : "Separate from website stock"}
                    </Badge>
                  </article>
                );
              })}
          </div>
          {canEdit && (
            <MovementForm
              catalog={catalog}
              variant={variant}
              stock={stock}
              onSaved={refresh}
            />
          )}
          {canEdit && (
            <InventoryPlanning
              catalog={catalog}
              stock={stock}
              variantId={variant.id}
              onSaved={refresh}
            />
          )}
          {!canEdit && stock.policies.length > 0 && (
            <section className="inv-panel inv-section">
              <h2>Low-stock thresholds</h2>
              <ul className="inv-variants">
                {stock.policies.map((policy) => (
                  <li key={policy.id}>
                    {catalog.locations.find(
                      (location) => location.id === policy.locationId,
                    )?.name ?? "Location"}
                    : threshold {policy.minimum}, target {policy.target} (
                    {policy.enabled ? "enabled" : "disabled"})
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="inv-section">
            <div className="section-heading">
              <h2>In transit</h2>
              <Badge>
                {stock.transfers.reduce(
                  (sum, transfer) => sum + transfer.remaining,
                  0,
                )}{" "}
                units
              </Badge>
            </div>
            {!stock.transfers.length && (
              <p className="inv-description">
                No open transfers for this variant.
              </p>
            )}
            <div className="inv-cards">
              {stock.transfers.map((transfer) => (
                <TransferCard
                  key={transfer.id}
                  transfer={transfer}
                  canEdit={canEdit}
                  onSaved={refresh}
                />
              ))}
            </div>
          </section>
          <section className="inv-section">
            <div className="section-heading">
              <h2>Movement history</h2>
            </div>
            {!stock.movements.length && (
              <p className="inv-description">No movements recorded yet.</p>
            )}
            <ol className="inv-history">
              {stock.movements.map((movement) => (
                <li key={movement.id}>
                  <div className="inv-history-title">
                    <strong>
                      {historyLabels[movement.kind] ?? movement.kind}
                    </strong>
                    <span>
                      {movement.countedOnHand !== null
                        ? "Counted " + movement.countedOnHand
                        : movement.quantity}{" "}
                      units
                    </span>
                  </div>
                  {movement.kind === "stocktake" && (
                    <p>
                      Previously recorded: {movement.before?.onHand} / Counted:{" "}
                      {movement.countedOnHand}
                      {movement.onHandDelta === 0
                        ? " / Count matched"
                        : " / Discrepancy recorded"}
                    </p>
                  )}
                  {movement.purchaseDelivery && (
                    <p>
                      {movement.purchaseDelivery.accepted} accepted /{" "}
                      {movement.purchaseDelivery.quarantined} quarantined /{" "}
                      {movement.purchaseDelivery.rejected} rejected
                    </p>
                  )}
                  <p>
                    {movement.locationName}
                    {movement.otherLocationName &&
                      " / " + movement.otherLocationName}
                  </p>
                  <p className="preserve-lines">
                    {movement.reason}
                    {movement.reference && " / " + movement.reference}
                  </p>
                  <p className="field-hint">
                    On-hand change: {movement.onHandDelta > 0 ? "+" : ""}
                    {movement.onHandDelta}
                    {movement.unitCostMinor !== null &&
                      " / Unit cost: " + usd(movement.unitCostMinor)}
                  </p>
                  <time dateTime={movement.createdAt}>
                    {new Date(movement.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
            {stock.nextCursor && (
              <Button variant="secondary" onClick={more} disabled={busy}>
                Load older movements
              </Button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
