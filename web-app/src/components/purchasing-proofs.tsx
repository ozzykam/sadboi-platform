"use client";
import { useEffect, useState } from "react";
import type {
  InventoryCatalog,
  ProofCatalog,
  ProofRecord,
  PurchaseOrderRecord,
} from "@sadboi/core";
import { Badge, Button } from "./ui";
import { InventoryForm, Input, Select, value } from "./inventory-form";
import { inventoryRequest } from "@/lib/inventory-client";

function ProofEditor({
  order,
  catalog,
  record,
  onSaved,
}: {
  order: PurchaseOrderRecord;
  catalog: ProofCatalog;
  record?: ProofRecord;
  onSaved: () => Promise<void>;
}) {
  const baseline = record;
  return (
    <InventoryForm
      endpoint="/api/purchasing"
      action="proof"
      record={baseline}
      label="Save proof update"
      successMessage="Proof update saved."
      again={false}
      onSaved={onSaved}
      prepare={(data) => ({
        orderId: order.id,
        variantId: value(data, "variantId"),
        assetId: value(data, "assetId"),
        version: Number(value(data, "version")),
        status: value(data, "status"),
        notes: value(data, "notes"),
      })}
    >
      <Select
        label="SKU"
        name="variantId"
        required
        defaultValue={baseline?.variantId ?? ""}
      >
        <option value="">Choose order line</option>
        {order.lines.map((line) => (
          <option key={line.variantId} value={line.variantId}>
            {line.sku} — {line.variantName}
          </option>
        ))}
      </Select>
      <Select
        label="Private artwork file"
        name="assetId"
        required
        defaultValue={baseline?.assetId ?? ""}
      >
        <option value="">Choose ready artwork asset</option>
        {catalog.assets.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.filename} · {new Date(asset.createdAt).toLocaleDateString()}
          </option>
        ))}
      </Select>
      <Input
        label="Proof version"
        name="version"
        type="number"
        min={1}
        max={500}
        step={1}
        required
        defaultValue={baseline?.version ?? 1}
      />
      <Select
        label="Proof status"
        name="status"
        required
        defaultValue={baseline?.status ?? "draft"}
      >
        <option value="draft">Draft</option>
        <option value="sent">Sent to supplier</option>
        <option value="changes_requested">Changes requested</option>
        <option value="approved">Approved</option>
        <option value="superseded">Superseded</option>
      </Select>
      <Input
        label="Notes / requested changes"
        name="notes"
        maxLength={2000}
        defaultValue={baseline?.notes}
        placeholder="Color, trim, proofing, or approval notes"
      />
    </InventoryForm>
  );
}

export function PurchasingProofs({
  order,
  canEdit,
}: {
  order: PurchaseOrderRecord;
  inventory?: InventoryCatalog;
  canEdit: boolean;
}) {
  const [catalog, setCatalog] = useState<ProofCatalog>({
    proofs: [],
    assets: [],
  });
  const [editing, setEditing] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setCatalog(
        await inventoryRequest("/api/purchasing?proofs=1&order=" + order.id),
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load proofs.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    inventoryRequest("/api/purchasing?proofs=1&order=" + order.id)
      .then((data) => {
        if (active) {
          setCatalog(data);
          setError("");
          setBusy(false);
        }
      })
      .catch((error) => {
        if (active) {
          setError(
            error instanceof Error ? error.message : "Could not load proofs.",
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
            {editing === "new" ? "Add proof handoff" : "Edit proof update"}
          </h2>
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Close editor
          </Button>
        </div>
        <ProofEditor
          order={order}
          catalog={catalog}
          record={catalog.proofs.find((item) => item.id === editing)}
          onSaved={saved}
        />
      </section>
    );
  return (
    <section className="inv-section">
      <div className="section-heading">
        <div>
          <h2>Print-file handoff &amp; proofs</h2>
          <p className="inv-description">
            Versioned private artwork files and supplier approval history.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setEditing("new")}>Add proof update</Button>
        )}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {busy && <p className="field-hint">Loading proof history…</p>}
      {!busy && !catalog.assets.length && (
        <p className="notice">
          Upload a private artwork image before recording a proof handoff.
        </p>
      )}
      {!busy && !catalog.proofs.length && (
        <p className="empty-state">No proof updates yet.</p>
      )}
      <div className="inv-cards">
        {catalog.proofs.map((proof) => (
          <article className="inv-panel" key={proof.id}>
            <div className="section-heading">
              <div>
                <h3>
                  v{proof.version} · {proof.sku}
                </h3>
                <p className="field-hint">
                  {proof.filename} · {proof.supplierName}
                </p>
              </div>
              <Badge
                tone={
                  proof.status === "approved"
                    ? "green"
                    : proof.status === "changes_requested"
                      ? "red"
                      : proof.status === "superseded"
                        ? "gold"
                        : "neutral"
                }
              >
                {proof.status.replaceAll("_", " ")}
              </Badge>
            </div>
            {proof.notes && <p className="preserve-lines">{proof.notes}</p>}
            <p className="field-hint">
              Updated {new Date(proof.updatedAt).toLocaleString()}
            </p>
            {canEdit && (
              <Button variant="secondary" onClick={() => setEditing(proof.id)}>
                Edit proof
              </Button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
