"use client";
import { useEffect, useState } from "react";
import type {
  BatchCatalog,
  BatchRecord,
  PurchaseOrderRecord,
  ReprintCatalog,
  ReprintRecord,
} from "@sadboi/core";
import { Badge, Button } from "./ui";
import { InventoryForm, Input, Select, value } from "./inventory-form";
import { inventoryRequest } from "@/lib/inventory-client";
function BatchEditor({
  order,
  record,
  onSaved,
}: {
  order: PurchaseOrderRecord;
  record?: BatchRecord;
  onSaved: () => Promise<void>;
}) {
  return (
    <InventoryForm
      endpoint="/api/purchasing"
      action="batch"
      record={record}
      label="Save production batch"
      successMessage="Production batch saved."
      again={false}
      onSaved={onSaved}
      prepare={(data) => ({
        orderId: order.id,
        variantId: value(data, "variantId"),
        batchNumber: value(data, "batchNumber"),
        quantity: Number(value(data, "quantity")),
        waste: Number(value(data, "waste")),
        status: value(data, "status"),
        notes: value(data, "notes"),
      })}
    >
      <Select
        label="SKU"
        name="variantId"
        required
        defaultValue={record?.variantId ?? ""}
      >
        <option value="">Choose order line</option>
        {order.lines.map((line) => (
          <option key={line.variantId} value={line.variantId}>
            {line.sku} — {line.variantName}
          </option>
        ))}
      </Select>
      <Input
        label="Batch number"
        name="batchNumber"
        required
        maxLength={80}
        defaultValue={record?.batchNumber}
        placeholder="RUN-01"
      />
      <Input
        label="Units in batch"
        name="quantity"
        required
        type="number"
        min={1}
        max={1000000}
        defaultValue={record?.quantity}
      />
      <Input
        label="Estimated waste / spoilage"
        name="waste"
        required
        type="number"
        min={0}
        max={1000000}
        defaultValue={record?.waste ?? 0}
      />
      <Select
        label="Batch status"
        name="status"
        required
        defaultValue={record?.status ?? "planned"}
      >
        <option value="planned">Planned</option>
        <option value="in_production">In production</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </Select>
      <Input
        label="Batch notes"
        name="notes"
        maxLength={2000}
        defaultValue={record?.notes}
        placeholder="Paper lot, machine run, or reprint notes"
      />
    </InventoryForm>
  );
}
export function ProductionBatches({
  order,
  canEdit,
}: {
  order: PurchaseOrderRecord;
  canEdit: boolean;
}) {
  const [catalog, setCatalog] = useState<BatchCatalog>({ batches: [] }),
    [reprints, setReprints] = useState<ReprintCatalog>({ reprints: [] }),
    [editing, setEditing] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const [next, nextReprints] = await Promise.all([
        inventoryRequest("/api/purchasing?batches=1&order=" + order.id),
        inventoryRequest("/api/purchasing?reprints=1&order=" + order.id),
      ]);
      setCatalog(next);
      setReprints(nextReprints);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not load production records.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      inventoryRequest("/api/purchasing?batches=1&order=" + order.id),
      inventoryRequest("/api/purchasing?reprints=1&order=" + order.id),
    ])
      .then(([next, nextReprints]) => {
        if (active) {
          setCatalog(next);
          setReprints(nextReprints);
          setBusy(false);
        }
      })
      .catch((error) => {
        if (active) {
          setError(
            error instanceof Error
              ? error.message
              : "Could not load production records.",
          );
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [order.id, order.revision]);
  async function saved() {
    setEditing(null);
    await refresh();
  }
  if (editing)
    return (
      <section className="inv-section">
        <div className="section-heading">
          <h2>
            {editing === "new"
              ? "Add production batch"
              : "Edit production batch"}
          </h2>
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Close editor
          </Button>
        </div>
        <BatchEditor
          order={order}
          record={catalog.batches.find((item) => item.id === editing)}
          onSaved={saved}
        />
      </section>
    );
  return (
    <section className="inv-section">
      <div className="section-heading">
        <div>
          <h2>Production batches</h2>
          <p className="inv-description">
            Track runs and waste separately from supplier milestone updates.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setEditing("new")}>Add batch</Button>
        )}
      </div>
      {error && <p className="notice error">{error}</p>}
      {busy && <p className="field-hint">Loading batches…</p>}
      {!busy && !catalog.batches.length && (
        <p className="empty-state">No batches recorded yet.</p>
      )}
      <div className="inv-cards">
        {catalog.batches.map((batch) => (
          <article className="inv-panel" key={batch.id}>
            <div className="section-heading">
              <div>
                <h3>
                  {batch.batchNumber} · {batch.sku}
                </h3>
                <p className="field-hint">
                  {batch.variantName} · {batch.quantity} units
                </p>
              </div>
              <Badge
                tone={
                  batch.status === "completed"
                    ? "green"
                    : batch.status === "cancelled"
                      ? "red"
                      : batch.status === "in_production"
                        ? "gold"
                        : "neutral"
                }
              >
                {batch.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <p>
              Waste/spoilage: {batch.waste} · Net expected:{" "}
              {batch.quantity - batch.waste}
            </p>
            {batch.notes && <p className="preserve-lines">{batch.notes}</p>}
            {canEdit && (
              <Button variant="secondary" onClick={() => setEditing(batch.id)}>
                Edit batch
              </Button>
            )}
          </article>
        ))}
      </div>
      <Reprints
        order={order}
        batches={catalog.batches}
        reprints={reprints}
        canEdit={canEdit}
        onChanged={refresh}
      />
    </section>
  );
}

function Reprints({
  order,
  batches,
  reprints,
  canEdit,
  onChanged,
}: {
  order: PurchaseOrderRecord;
  batches: BatchRecord[];
  reprints: ReprintCatalog;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<ReprintRecord | null>(null);
  return (
    <section className="inv-section">
      <div className="section-heading">
        <div>
          <h2>Reprint requests</h2>
          <p className="inv-description">
            Track replacement runs without changing the original order quantity.
          </p>
        </div>
        {canEdit && batches.length > 0 && (
          <Button onClick={() => setEditing({} as ReprintRecord)}>
            Add reprint request
          </Button>
        )}
      </div>
      {editing && (
        <InventoryForm
          endpoint="/api/purchasing"
          action="reprint"
          record={editing.id ? editing : undefined}
          label="Save reprint request"
          successMessage="Reprint request saved."
          again={false}
          onSaved={async () => {
            setEditing(null);
            await onChanged();
          }}
          prepare={(data) => ({
            orderId: order.id,
            variantId: value(data, "variantId"),
            batchId: value(data, "batchId"),
            quantity: Number(value(data, "quantity")),
            reason: value(data, "reason"),
            status: value(data, "status"),
          })}
        >
          <Select
            label="SKU"
            name="variantId"
            required
            defaultValue={editing.variantId}
          >
            <option value="">Choose SKU</option>
            {order.lines.map((line) => (
              <option key={line.variantId} value={line.variantId}>
                {line.sku}
              </option>
            ))}
          </Select>
          <Select
            label="Original batch"
            name="batchId"
            required
            defaultValue={editing.batchId}
          >
            <option value="">Choose batch</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.batchNumber} · {batch.sku}
              </option>
            ))}
          </Select>
          <Input
            label="Reprint quantity"
            name="quantity"
            type="number"
            min={1}
            max={1000000}
            required
            defaultValue={editing.quantity}
          />
          <Input
            label="Reason"
            name="reason"
            required
            minLength={3}
            maxLength={2000}
            defaultValue={editing.reason}
            placeholder="Damage, color drift, or short shipment"
          />
          <Select
            label="Status"
            name="status"
            required
            defaultValue={editing.status ?? "requested"}
          >
            <option value="requested">Requested</option>
            <option value="approved">Approved</option>
            <option value="in_production">In production</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </InventoryForm>
      )}
      {!reprints.reprints.length && !editing && (
        <p className="field-hint">No reprint requests recorded.</p>
      )}
      {reprints.reprints.map((reprint) => (
        <article className="inv-panel" key={reprint.id}>
          <Badge
            tone={
              reprint.status === "completed"
                ? "green"
                : reprint.status === "cancelled"
                  ? "red"
                  : "gold"
            }
          >
            {reprint.status.replaceAll("_", " ")}
          </Badge>
          <h3>
            {reprint.quantity} units · {reprint.sku}
          </h3>
          <p className="preserve-lines">{reprint.reason}</p>
          {canEdit && (
            <Button variant="secondary" onClick={() => setEditing(reprint)}>
              Edit request
            </Button>
          )}
        </article>
      ))}
    </section>
  );
}
