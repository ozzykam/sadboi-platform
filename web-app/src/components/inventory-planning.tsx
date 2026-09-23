"use client";

import { useEffect, useState } from "react";
import {
  reconcileStock,
  type InventoryCatalog,
  type InventoryStock,
  type StockBalance,
  type StockPolicyRecord,
  type ReplenishmentQueue,
} from "@sadboi/core";
import { inventoryRequest } from "@/lib/inventory-client";
import { Badge, Button } from "./ui";
import { InventoryForm, Input, Select, value } from "./inventory-form";

function CountEntry({
  initial,
  onSaved,
}: {
  initial: StockBalance;
  onSaved: () => Promise<void>;
}) {
  // The count belongs to the balance the operator saw when counting began.
  const [baseline] = useState(initial);
  const [counted, setCounted] = useState("");
  const validCount =
    counted !== "" &&
    Number.isSafeInteger(Number(counted)) &&
    Number(counted) >= 0;
  const discrepancy = validCount ? Number(counted) - baseline.onHand : null;
  const stale = baseline.revision !== initial.revision;
  return (
    <InventoryForm
      action="stocktake"
      label="Record counted total"
      again={false}
      onSaved={onSaved}
      prepare={(data) => {
        const countedOnHand = Number(value(data, "countedOnHand"));
        reconcileStock(baseline, countedOnHand);
        return {
          variantId: baseline.variantId,
          locationId: baseline.locationId,
          expectedRevision: baseline.revision,
          countedOnHand,
          reason: value(data, "reason"),
          reference: value(data, "reference"),
        };
      }}
    >
      {stale && (
        <p className="notice inv-wide">
          The saved balance changed. Start a fresh count and recount the units
          before saving.
        </p>
      )}
      <Input
        label="Actual physical count"
        name="countedOnHand"
        type="number"
        min={0}
        max={1000000000}
        step={1}
        required
        value={counted}
        onChange={(event) => setCounted(event.target.value)}
        helperText="Include all units physically here, including units set aside or committed to orders. Exclude units still in transit."
      />
      <Input
        label="Count reason"
        name="reason"
        required
        minLength={3}
        maxLength={1000}
        placeholder="Opening count, monthly stocktake, or discrepancy investigation"
      />
      <Input
        label="Count reference (optional)"
        name="reference"
        maxLength={160}
        placeholder="Count sheet or stocktake reference"
      />
      <div className="inv-count-preview inv-wide" aria-live="polite">
        <span>
          Recorded on hand: <strong>{baseline.onHand}</strong>
        </span>
        <span>
          Counted: <strong>{validCount ? counted : "—"}</strong>
        </span>
        <span>
          Adjustment:{" "}
          <strong>
            {discrepancy === null
              ? "—"
              : discrepancy > 0
                ? "+" + discrepancy
                : discrepancy}
          </strong>
        </span>
      </div>
      <label className="inv-check inv-wide">
        <input type="checkbox" required />I have reviewed the count and
        adjustment.
      </label>
    </InventoryForm>
  );
}

function PolicyEntry({
  policy,
  variantId,
  locationId,
  onSaved,
}: {
  policy?: StockPolicyRecord;
  variantId: string;
  locationId: string;
  onSaved: () => Promise<void>;
}) {
  const [baseline] = useState(policy);
  return (
    <InventoryForm
      action="stock-policy"
      label="Save threshold"
      again={false}
      onSaved={onSaved}
      prepare={(data) => ({
        variantId,
        locationId,
        expectedRevision: baseline?.revision ?? 0,
        minimum: Number(value(data, "minimum")),
        target: Number(value(data, "target")),
        enabled: data.has("enabled"),
      })}
    >
      {(baseline?.revision ?? 0) !== (policy?.revision ?? 0) && (
        <p className="notice inv-wide">
          This threshold changed. Choose Edit latest threshold before making
          another change.
        </p>
      )}
      <Input
        label="Flag when available units reach"
        name="minimum"
        type="number"
        min={0}
        max={999999}
        step={1}
        required
        defaultValue={baseline?.minimum ?? ""}
        placeholder="5"
        helperText="Appears in Low stock when availability is at or below this number. Zero flags an empty location."
      />
      <Input
        label="Target available units"
        name="target"
        type="number"
        min={1}
        max={1000000}
        step={1}
        required
        defaultValue={baseline?.target ?? ""}
        placeholder="20"
        helperText="Choose a target above the threshold."
      />
      <label className="inv-check inv-wide">
        <input
          name="enabled"
          type="checkbox"
          defaultChecked={baseline?.enabled ?? true}
        />
        Include this variant and location in low-stock checks
      </label>
    </InventoryForm>
  );
}

export function InventoryPlanning({
  catalog,
  stock,
  variantId,
  onSaved,
}: {
  catalog: InventoryCatalog;
  stock: InventoryStock;
  variantId: string;
  onSaved: () => Promise<void>;
}) {
  const [locationId, setLocationId] = useState(
    catalog.locations.find((site) => site.status === "active")?.id ?? "",
  );
  const [countGeneration, setCountGeneration] = useState(0);
  const [policyGeneration, setPolicyGeneration] = useState(0);
  const [mode, setMode] = useState<"count" | "threshold">("count");
  const site = catalog.locations.find((location) => location.id === locationId);
  const current = stock.balances.find(
    (balance) => balance.locationId === locationId,
  ) ?? {
    variantId,
    locationId,
    onHand: 0,
    reserved: 0,
    allocated: 0,
    unavailable: 0,
    revision: 0,
  };
  const policy = stock.policies.find(
    (record) => record.locationId === locationId,
  );
  if (!catalog.locations.length) return null;
  return (
    <section className="inv-panel inv-section">
      <h2>Counts &amp; low-stock thresholds</h2>
      <p className="inv-description">
        Record the number you actually counted, or decide when this location
        needs more stock.
      </p>
      <Select
        label="Location to count or monitor"
        value={locationId}
        onChange={(event) => setLocationId(event.target.value)}
      >
        <option value="">Choose location</option>
        {catalog.locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
            {location.status === "archived" ? " (archived)" : ""}
          </option>
        ))}
      </Select>
      <div className="inv-tabs" role="group" aria-label="Stock planning action">
        <Button
          variant="secondary"
          aria-pressed={mode === "count"}
          onClick={() => setMode("count")}
        >
          Count physical stock
        </Button>
        <Button
          variant="secondary"
          aria-pressed={mode === "threshold"}
          onClick={() => setMode("threshold")}
        >
          Low-stock threshold
        </Button>
      </div>
      {site &&
        (mode === "count" ? (
          site.status === "active" ? (
            <>
              <Button
                variant="ghost"
                onClick={() =>
                  setCountGeneration((generation) => generation + 1)
                }
              >
                Start a fresh count
              </Button>
              <CountEntry
                key={locationId + ":" + countGeneration}
                initial={current}
                onSaved={onSaved}
              />
            </>
          ) : (
            <p className="notice">
              Restore this location before recording a count.
            </p>
          )
        ) : (
          <>
            <p className="field-hint">
              Thresholds apply to active stocked variants at studio, gallery,
              and event locations. You can turn an existing threshold off here.
            </p>
            <Button
              variant="ghost"
              onClick={() =>
                setPolicyGeneration((generation) => generation + 1)
              }
            >
              Edit latest threshold
            </Button>
            <PolicyEntry
              key={locationId + ":" + policyGeneration}
              policy={policy}
              variantId={variantId}
              locationId={locationId}
              onSaved={onSaved}
            />
          </>
        ))}
    </section>
  );
}

export function ReplenishmentPanel({
  canEdit,
  onViewStock,
}: {
  canEdit: boolean;
  onViewStock: (variantId: string) => void;
}) {
  const [queue, setQueue] = useState<ReplenishmentQueue | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    inventoryRequest("/api/inventory/replenishment")
      .then((data) => {
        if (active) setQueue(data);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setQueue(await inventoryRequest("/api/inventory/replenishment"));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not refresh low stock.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="section-heading">
        <h2>Stock that needs attention</h2>
        <Button variant="secondary" onClick={refresh} disabled={busy}>
          {busy ? "Refreshing..." : "Refresh low stock"}
        </Button>
      </div>
      <p className="inv-description">
        Suggestions bring available units up to your target at each location.
        Check incoming transfers and open supplier orders before arranging more
        stock.
      </p>
      {canEdit && (
        <p className="field-hint">
          Set a threshold under View stock → Counts &amp; low-stock thresholds
          for each location you want to monitor.
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {!queue && !error && (
        <p role="status" className="notice">
          Checking stock...
        </p>
      )}
      {queue && (
        <>
          <p className="field-hint">
            {queue.enabledPolicies} active thresholds / {queue.items.length}{" "}
            locations to review. Last checked{" "}
            {new Date(queue.generatedAt).toLocaleTimeString()}.
          </p>
          {!queue.items.length && (
            <div className="empty-state">
              <h2>
                {queue.enabledPolicies
                  ? "Monitored stock is above its thresholds."
                  : "No active thresholds yet."}
              </h2>
              <p>
                {queue.enabledPolicies
                  ? "Only locations with a configured, enabled threshold are checked."
                  : "Thresholds monitor active stocked variants at active studio, gallery, and event locations."}
              </p>
            </div>
          )}
          <div className="inv-cards">
            {queue.items.map((item) => (
              <article
                className="inv-panel"
                key={item.variantId + item.locationId}
              >
                <Badge tone={item.available === 0 ? "red" : "gold"}>
                  {item.available === 0
                    ? "Out of available stock"
                    : "Low stock"}
                </Badge>
                <h3 className="inv-description">
                  {item.productTitle} / {item.variantName}
                </h3>
                <p>
                  {item.sku} · {item.locationName}
                </p>
                <dl className="inv-balances">
                  <div>
                    <dt>Available</dt>
                    <dd>{item.available}</dd>
                  </div>
                  <div>
                    <dt>Suggested replenishment</dt>
                    <dd>{item.suggested}</dd>
                  </div>
                </dl>
                <p className="field-hint">
                  Threshold {item.minimum} / Target {item.target}
                </p>
                <div className="inv-actions">
                  <Button
                    variant="secondary"
                    onClick={() => onViewStock(item.variantId)}
                  >
                    View stock &amp; transfers
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
