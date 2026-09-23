"use client";
import { useEffect, useState } from "react";
import type {
  InventoryCatalog,
  ReservationCatalog,
  ReservationRecord,
} from "@sadboi/core";
import { Badge, Button } from "./ui";
import { InventoryForm, Input, Select, value } from "./inventory-form";
import { inventoryRequest } from "@/lib/inventory-client";
export function InventoryReservations({
  inventory,
  canEdit,
}: {
  inventory: InventoryCatalog;
  canEdit: boolean;
}) {
  const [catalog, setCatalog] = useState<ReservationCatalog>({
      reservations: [],
    }),
    [editing, setEditing] = useState<ReservationRecord | null>(null),
    [error, setError] = useState("");
  async function refresh() {
    try {
      setCatalog(await inventoryRequest("/api/inventory?reservations=1"));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load reservations.",
      );
    }
  }
  useEffect(() => {
    let active = true;
    inventoryRequest("/api/inventory?reservations=1")
      .then((data) => {
        if (active) setCatalog(data);
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load reservations.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  if (editing)
    return (
      <section className="inv-panel">
        <div className="section-heading">
          <h2>{editing.id ? "Edit reservation" : "Add reservation"}</h2>
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Close
          </Button>
        </div>
        <InventoryForm
          action="reservation"
          record={editing.id ? editing : undefined}
          label="Save reservation"
          successMessage="Reservation saved."
          again={false}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
          prepare={(data) => ({
            variantId: value(data, "variantId"),
            locationId: value(data, "locationId"),
            reference: value(data, "reference"),
            purpose: value(data, "purpose"),
            quantity: Number(value(data, "quantity")),
            status: value(data, "status"),
            notes: value(data, "notes"),
          })}
        >
          <Select
            label="Variant"
            name="variantId"
            required
            defaultValue={editing.variantId}
          >
            <option value="">Choose SKU</option>
            {inventory.variants
              .filter((item) => item.status === "active")
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} · {item.name}
                </option>
              ))}
          </Select>
          <Select
            label="Location"
            name="locationId"
            required
            defaultValue={editing.locationId}
          >
            <option value="">Choose location</option>
            {inventory.locations
              .filter((item) => item.status === "active")
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </Select>
          <Select
            label="Purpose"
            name="purpose"
            required
            defaultValue={editing.purpose ?? "internal"}
          >
            <option value="commission">Commission</option>
            <option value="event">Event</option>
            <option value="wholesale">Wholesale</option>
            <option value="internal">Internal hold</option>
          </Select>
          <Input
            label="Reference"
            name="reference"
            required
            maxLength={160}
            defaultValue={editing.reference}
            placeholder="COMM-24 or EVENT-FALL"
          />
          <Input
            label="Quantity"
            name="quantity"
            type="number"
            min={1}
            max={1000000}
            required
            defaultValue={editing.quantity}
          />
          <Select
            label="Status"
            name="status"
            required
            defaultValue={editing.status ?? "reserved"}
          >
            <option value="reserved">Reserved</option>
            <option value="allocated">Allocated</option>
            <option value="released">Released</option>
            <option value="fulfilled">Fulfilled</option>
          </Select>
          <Input
            label="Notes"
            name="notes"
            maxLength={2000}
            defaultValue={editing.notes}
          />
        </InventoryForm>
      </section>
    );
  return (
    <section>
      <div className="section-heading">
        <div>
          <h2>Reservations &amp; allocations</h2>
          <p className="inv-description">
            Protect available units for commissions, events, wholesale, or
            internal holds.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setEditing({} as ReservationRecord)}>
            Add reservation
          </Button>
        )}
      </div>
      {error && <p className="notice error">{error}</p>}
      <Button variant="secondary" onClick={refresh}>
        Refresh reservations
      </Button>
      {!catalog.reservations.length && (
        <p className="empty-state">No reservations yet.</p>
      )}
      <div className="inv-cards">
        {catalog.reservations.map((item) => (
          <article className="inv-panel" key={item.id}>
            <Badge
              tone={
                item.status === "allocated"
                  ? "gold"
                  : item.status === "released" || item.status === "fulfilled"
                    ? "neutral"
                    : "green"
              }
            >
              {item.status}
            </Badge>
            <h3>
              {item.quantity} · {item.sku}
            </h3>
            <p>
              {item.locationName} · {item.purpose} · {item.reference}
            </p>
            {item.notes && <p className="preserve-lines">{item.notes}</p>}
            {canEdit && (
              <Button variant="secondary" onClick={() => setEditing(item)}>
                Edit reservation
              </Button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
